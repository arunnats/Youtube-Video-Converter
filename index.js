const express = require("express");
const ejs = require("ejs");
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");
const ytdl = require("ytdl-core");

const app = express();
const port = 3000;

app.set("views", path.join(__dirname, "public", "views"));
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/download-video", async (req, res) => {
	try {
		const videoUrl = req.query.url;
		if (!ytdl.validateURL(videoUrl)) {
			return res.status(400).send("Invalid YouTube URL");
		}

		// Fetch video info to get the title
		const info = await ytdl.getInfo(videoUrl);
		const title = info.videoDetails.title;

		// Create filename based on the video title
		const filename = title.replace(/[^\w\s]/gi, "") + ".mp4";

		// Pipe the video stream directly to a file with the video title as filename
		ytdl(videoUrl).pipe(fs.createWriteStream(filename));

		// Send a success response back to the client
		res
			.status(200)
			.send(`Video download started successfully. Filename: ${filename}`);
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
