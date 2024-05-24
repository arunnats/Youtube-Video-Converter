const express = require("express");
const ejs = require("ejs");
const path = require("path");
const bodyParser = require("body-parser");
const ytdl = require("ytdl-core");
const ffmpeg = require("ffmpeg-static");
const cp = require("child_process");
const readline = require("readline");

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
		const title = info.videoDetails.title.replace(/[^\w\s]/gi, "");
		const filename = `${title}.${format}`;

		res.header("Content-Disposition", `attachment; filename="${filename}"`);
		res.header("Content-Type", `video/${format}`);

		const audio = ytdl(url, { quality: "highestaudio" });
		const video = ytdl(url, { quality: "highestvideo" });

		// Log the ffmpeg command being executed
		console.log("ffmpeg path:", ffmpeg);

		// Start the ffmpeg child process
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
				`-f`,
				format,
				"pipe:6",
			],
			{
				windowsHide: true,
				stdio: [
					"inherit",
					"inherit",
					"inherit",
					"pipe",
					"pipe",
					"pipe",
					"pipe",
				],
			}
		);

		ffmpegProcess.stdio[6].pipe(res);

		ffmpegProcess.on("close", () => {
			console.log("done");
		});

		audio.pipe(ffmpegProcess.stdio[4]);
		video.pipe(ffmpegProcess.stdio[5]);
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
