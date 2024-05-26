const express = require("express");
const ejs = require("ejs");
const path = require("path");
const bodyParser = require("body-parser");
const ytdl = require("ytdl-core");
const sanitize = require("sanitize-filename");
const ffmpeg = "./ffmpeg/bin/ffmpeg.exe";
const cp = require("child_process");
const fs = require("fs");

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
		const unsanVideoTitle = info.videoDetails.title;
		console.log("Video title:", unsanVideoTitle);

		const sanitizedTitle = sanitize(unsanVideoTitle);
		console.log("Sanitized title:", sanitizedTitle);

		let resolution = quality;
		if (quality === "highest") {
			resolution = "Highest";
		} else if (quality === "lowest") {
			resolution = "Lowest";
		}

		const finalTitle = `${sanitizedTitle} (${resolution})`;
		console.log("Final title with resolution:", finalTitle);

		res.setHeader("Video-Title", finalTitle);

		if (format === "mp3") {
			console.log("Downloading audio...");

			const audioFormat = ytdl.chooseFormat(info.formats, {
				quality: "highestaudio",
			});
			console.log("Selected audio format:", audioFormat);

			const filename = `${finalTitle}.mp3`;
			console.log("Download filename:", filename);

			res.header("Content-Disposition", `attachment; filename="${filename}"`);
			res.header("Content-Type", "audio/mpeg charset=UTF-8");

			const audioStream = ytdl.downloadFromInfo(info, { format: audioFormat });
			audioStream.pipe(res);

			console.log("Audio download initiated.");
		} else if (format === "mp4" || format === "webm" || format === "mkv") {
			const outputFileName = `${finalTitle}.${format}`;
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

app.get("/", (req, res) => {
	res.render("index");
	console.log(`App Launched`);
});

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
