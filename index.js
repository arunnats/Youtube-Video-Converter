const express = require("express");
const ejs = require("ejs");
const path = require("path");
const bodyParser = require("body-parser");
const ytdl = require("ytdl-core");
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
			return res.status(400).send("Invalid YouTube URL");
		}

		const info = await ytdl.getInfo(url);

		if (format === "mp3") {
			let audioOptions = {};

			if (quality === "highest") {
				audioOptions.quality = "highestaudio";
			} else if (quality === "lowest") {
				audioOptions.quality = "lowestaudio";
			} else {
				return res.status(400).send("Invalid audio quality option");
			}

			const audioFormat = ytdl.chooseFormat(info.formats, audioOptions);
			if (!audioFormat) {
				return res.status(400).send("Audio format not available");
			}

			res.header(
				"Content-Disposition",
				`attachment; filename="${info.videoDetails.title}.mp3"`
			);
			res.header("Content-Type", "audio/mpeg");

			const audioStream = ytdl.downloadFromInfo(info, { format: audioFormat });
			audioStream.pipe(res);
		} else if (format === "webm" || format === "mp4") {
			let videoOptions = {};

			if (quality === "highest") {
				videoOptions.quality = "highest";
			} else if (quality === "lowest") {
				videoOptions.quality = "lowest";
			} else {
				const selectedFormat = info.formats.find(
					(fmt) => fmt.qualityLabel === quality
				);
				if (!selectedFormat) {
					return res.status(400).send("Selected quality is not available");
				}
				videoOptions.filter = (fmt) => fmt.qualityLabel === quality;
			}

			const videoFormats = ytdl.filterFormats(info.formats, videoOptions);
			const selectedVideoFormat = videoFormats[0];

			res.header(
				"Content-Disposition",
				`attachment; filename="${info.videoDetails.title}.${format}"`
			);
			res.header("Content-Type", `video/${format}`);

			const videoStream = ytdl.downloadFromInfo(info, {
				format: selectedVideoFormat,
			});
			videoStream.pipe(res);
		} else {
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
