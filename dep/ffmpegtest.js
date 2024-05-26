const express = require("express");
const ytdl = require("ytdl-core");
const { spawn } = require("child_process");

const app = express();
const port = 3000;

app.get("/download-video", async (req, res) => {
	try {
		const { url } = req.query;

		if (!ytdl.validateURL(url)) {
			return res.status(400).send("Invalid YouTube URL");
		}

		const videoInfo = await ytdl.getInfo(url);
		const sanitizedTitle = sanitizeFilename(videoInfo.videoDetails.title);

		const audioStream = ytdl(url, { quality: "highestaudio" });
		const videoStream = ytdl(url, { quality: "highestvideo" });

		const ffmpegCommand = [
			"-i",
			"pipe:4",
			"-i",
			"pipe:5",
			"-c:v",
			"copy",
			"-c:a",
			"aac",
			"-f",
			"mp4",
			"pipe:1", // Output to stdout
		];

		const ffmpegProcess = spawn("ffmpeg", ffmpegCommand, {
			stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"],
		});

		audioStream.on("error", (err) => {
			console.error("Error downloading audio:", err);
			res.status(500).send("Error downloading video");
		});

		videoStream.on("error", (err) => {
			console.error("Error downloading video:", err);
			res.status(500).send("Error downloading video");
		});

		ffmpegProcess.stdout.on("error", (err) => {
			console.error("FFmpeg process error:", err);
			res.status(500).send("Error processing video");
		});

		ffmpegProcess.stdout.pipe(res);

		audioStream.pipe(ffmpegProcess.stdio[4]);
		videoStream.pipe(ffmpegProcess.stdio[5]);

		ffmpegProcess.on("error", (error) => {
			console.error("FFmpeg process error:", error);
			res.status(500).send("Error processing video");
		});

		ffmpegProcess.on("close", () => {
			console.log("FFmpeg process finished");
		});
	} catch (error) {
		console.error("Error downloading video:", error);
		res.status(500).send("Error downloading video");
	}
});

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});

function sanitizeFilename(filename) {
	return filename.replace(/[^\w\s.-]/g, "_");
}
