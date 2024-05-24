const express = require("express");
const ejs = require("ejs");
const path = require("path");
const bodyParser = require("body-parser");
const ytdl = require("ytdl-core");
const sanitize = require("sanitize-filename");

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

		res.setHeader("Video-Title", sanitizedTitle);

		if (format === "mp3") {
			console.log("Downloading audio...");

			const audioFormat = ytdl.chooseFormat(info.formats, {
				quality: "highestaudio",
			});
			console.log("Selected audio format:", audioFormat);

			const filename = `${sanitizedTitle}.mp3`;
			console.log("Download filename:", filename);

			res.header("Content-Disposition", `attachment; filename="${filename}"`);
			res.header("Content-Type", "audio/mpeg charset=UTF-8`");

			const audioStream = ytdl.downloadFromInfo(info, { format: audioFormat });
			audioStream.pipe(res);

			console.log("Audio download initiated.");
		} else if (format === "webm" || format === "mp4") {
			console.log("Downloading video...");

			let videoOptions = {};
			let audioOptions = {};

			if (quality === "highest") {
				videoOptions.quality = "highest";
				audioOptions.quality = "highestaudio";
			} else if (quality === "lowest") {
				videoOptions.quality = "lowest";
				audioOptions.quality = "lowestaudio";
			} else {
				const selectedFormat = info.formats.find(
					(fmt) => fmt.qualityLabel === quality
				);
				if (!selectedFormat) {
					console.log("Selected quality is not available:", quality);
					return res.status(400).send("Selected quality is not available");
				}
				videoOptions.filter = (fmt) => fmt.qualityLabel === quality;
				audioOptions.filter = (fmt) => fmt.qualityLabel === quality;
			}

			const videoFormat = ytdl.chooseFormat(info.formats, videoOptions);
			const audioFormat = ytdl.chooseFormat(info.formats, audioOptions);

			const filename = `${sanitizedTitle}.${format}`;
			console.log("Download filename:", filename);

			res.header("Content-Disposition", `attachment; filename="${filename}"`);
			res.header("Content-Type", `video/${format} charset=UTF-8`);

			const audioStream = ytdl.downloadFromInfo(info, { format: audioFormat });
			const videoStream = ytdl.downloadFromInfo(info, { format: videoFormat });

			audioStream.pipe(res, { end: false });

			audioStream.on("end", () => {
				videoStream.pipe(res);
			});

			console.log("Video download initiated.");
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
