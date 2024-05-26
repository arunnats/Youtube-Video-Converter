const express = require("express");
const ejs = require("ejs");
const path = require("path");
const bodyParser = require("body-parser");
const ytdl = require("ytdl-core");
const sanitize = require("sanitize-filename");
const ffmpeg = "./ffmpeg/bin/ffmpeg.exe";
const fs = require("fs");
const cp = require("child_process");
const { spawn } = require("child_process");
const AdmZip = require("adm-zip");

const app = express();
const port = 3000;

app.set("views", path.join(__dirname, "public", "views"));
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/download-video", async (req, res) => {
	try {
		const { url, format, quality } = req.query;
		console.log("Request query parameters:", req.query);

		if (!ytdl.validateURL(url)) {
			console.log("Invalid YouTube URL:", url);
			return res.status(400).send("Invalid YouTube URL");
		}

		const info = await ytdl.getInfo(url);
		const videoTitle = info.videoDetails.title;
		console.log("Video title:", videoTitle);

		const sanitizedTitle = sanitize(videoTitle);
		console.log("Sanitized title:", sanitizedTitle);

		const titleWithQuality = `${sanitizedTitle} [${quality}]`;
		console.log("Title with quality:", titleWithQuality);

		res.setHeader("Video-Title", titleWithQuality);

		if (format === "mp3") {
			console.log("Downloading audio...");

			const audioFormat = ytdl.chooseFormat(info.formats, {
				quality: "highestaudio",
			});
			console.log("Selected audio format:", audioFormat);

			const audioPath = `temp_audio_${titleWithQuality}.m4a`;
			const audioFile = fs.createWriteStream(audioPath);

			const audioStream = ytdl.downloadFromInfo(info, { format: audioFormat });
			audioStream.pipe(audioFile);

			audioFile.on("finish", () => {
				console.log("Audio file downloaded.");

				const mp3Path = `${titleWithQuality}.mp3`;
				const ffmpegArgs = [
					"-i",
					audioPath,
					"-codec:a",
					"libmp3lame",
					"-q:a",
					"2",
					mp3Path,
				];

				const ffmpegProcess = cp.spawn(ffmpeg, ffmpegArgs, {
					windowsHide: true,
				});

				ffmpegProcess.on("error", (err) => {
					console.error("Error converting audio to MP3:", err);
					res.status(500).send("Error converting audio to MP3");
				});

				ffmpegProcess.on("close", (code) => {
					if (code === 0) {
						fs.unlinkSync(audioPath);
						res.download(mp3Path, (err) => {
							if (err) {
								console.error("Error sending file:", err);
								res.status(500).send("Error sending file");
							}
							fs.unlink(mp3Path, (err) => {
								if (err) {
									console.error("Error deleting file:", err);
								} else {
									console.log("Temporary file deleted");
								}
							});
						});
					} else {
						console.error(`FFmpeg process exited with code ${code}`);
						res.status(500).send("Error converting audio to MP3");
					}
				});
			});
		} else if (format === "mp4" || format === "mkv") {
			console.log("Downloading video...");

			const videoFormat = ytdl.chooseFormat(info.formats, { quality: quality });
			if (!videoFormat) {
				console.log("Requested quality not available:", quality);
				return res.status(404).send("Requested quality not available");
			}

			const outputFileName = `${titleWithQuality}.${format}`;
			const outputPath = path.join(__dirname, outputFileName);

			const audio = ytdl(url, { quality: "highestaudio" });
			const video = ytdl(url, { quality });

			video.on("info", (info) => {
				if (!info) {
					return res.status(400).send("Quality not found");
				}
			});

			const ffmpegProcess = cp.spawn(
				ffmpeg,
				[
					"-loglevel",
					"8",
					"-hide_banner",
					"-progress",
					"pipe:3",
					"-i",
					"pipe:4",
					"-i",
					"pipe:5",
					"-map",
					"0:a",
					"-map",
					"1:v",
					"-c:v",
					"copy",
					outputPath,
				],
				{
					windowsHide: true,
					stdio: ["inherit", "inherit", "inherit", "pipe", "pipe", "pipe"],
				}
			);

			ffmpegProcess.on("close", () => {
				console.log("FFmpeg process finished");
				res.download(outputPath, (err) => {
					if (err) {
						console.error("Error sending file:", err);
						res.status(500).send("Error sending file");
					}
					fs.unlink(outputPath, (err) => {
						if (err) {
							console.error("Error deleting file:", err);
						} else {
							console.log("Temporary file deleted");
						}
					});
				});
			});

			ffmpegProcess.stdio[3].on("data", (chunk) => {
				const lines = chunk.toString().trim().split("\n");
				const args = {};
				for (const l of lines) {
					const [key, value] = l.split("=");
					args[key.trim()] = value.trim();
				}
			});
			audio.pipe(ffmpegProcess.stdio[4]);
			video.pipe(ffmpegProcess.stdio[5]);
		} else {
			console.log("Invalid format:", format);
			return res.status(400).send("Invalid format");
		}
	} catch (error) {
		console.error("Error downloading video:", error);
		res.status(500).send("Error downloading video");
	}
});

app.get("/download-multi-audio", async (req, res) => {
	try {
		const { urls } = req.query;
		console.log("Request query parameters:", req.query);

		if (!urls || urls.indexOf(";") === -1) {
			return res
				.status(400)
				.send(
					"Please provide valid YouTube video URLs separated by semicolons (;)"
				);
		}

		const urlArray = urls.split(";");

		// Remove duplicates
		const urlList = [];
		const uniqueUrls = new Set();

		for (const url of urlArray) {
			if (!uniqueUrls.has(url.trim())) {
				uniqueUrls.add(url.trim());
				urlList.push(url.trim());
			}
		}

		if (urlList.length !== urlArray.length) {
			return res
				.status(400)
				.send("Duplicate URLs are not allowed. Please provide unique URLs.");
		}

		const zip = new AdmZip();
		const promises = [];

		for (const url of urlList) {
			promises.push(downloadAudio(url, zip));
		}

		await Promise.all(promises);

		const zipFileName = "audio_files.zip";
		const zipData = zip.toBuffer();
		res.set("Content-Disposition", `attachment; filename="${zipFileName}"`);
		res.set("Content-Type", "application/zip");
		res.set("Content-Length", zipData.length);
		res.end(zipData);
	} catch (error) {
		console.error("Error:", error);
		res.status(500).send("An error occurred");
	}
});

async function downloadAudio(url, zip) {
	console.log("Downloading audio:", url);
	const info = await ytdl.getInfo(url);
	const audioFormat = ytdl.chooseFormat(info.formats, {
		quality: "highestaudio",
	});
	console.log("Selected audio format:", audioFormat);

	const titleWithQuality = `${info.videoDetails.title}_audio`;
	const audioPath = `temp_audio_${titleWithQuality}.mp3`;
	const mp3Path = `${titleWithQuality}.mp3`;

	await new Promise((resolve, reject) => {
		const audioStream = ytdl.downloadFromInfo(info, { format: audioFormat });
		const audioFile = fs.createWriteStream(audioPath);

		audioStream.pipe(audioFile);

		audioFile.on("finish", async () => {
			console.log("Downloaded audio:", audioPath);
			const mp3Path = `${titleWithQuality}.mp3`;
			const ffmpegArgs = [
				"-i",
				audioPath,
				"-codec:a",
				"libmp3lame",
				"-q:a",
				"2",
				mp3Path,
			];

			const ffmpegProcess = cp.spawn(ffmpeg, ffmpegArgs, { windowsHide: true });

			ffmpegProcess.on("error", (err) => {
				console.error("Error converting audio to MP3:", err);
				reject(err);
			});

			ffmpegProcess.on("close", (code) => {
				if (code === 0) {
					console.log("Converted audio to MP3:", mp3Path);
					zip.addLocalFile(mp3Path);
					resolve();
				} else {
					console.error(`FFmpeg process exited with code ${code}`);
					reject(`FFmpeg process exited with code ${code}`);
				}
			});
		});

		audioFile.on("error", (err) => {
			console.error("Error downloading audio:", err);
			reject(err);
		});
	});

	fs.unlinkSync(audioPath);
	fs.unlinkSync(mp3Path);
}

app.get("/", (req, res) => {
	res.render("index");
	console.log(`App Launched`);
});

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
