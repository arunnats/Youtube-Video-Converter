const express = require("express");
const ejs = require("ejs");
const path = require("path");
const bodyParser = require("body-parser");
const ytdl = require("ytdl-core");

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

		// Select the desired format and quality
		const videoFormat = ytdl.chooseFormat(info.formats, {
			quality: quality === "highest" ? "highest" : "lowest",
			filter: (formatObj) => formatObj.container === format,
		});

		if (!videoFormat) {
			return res
				.status(400)
				.send("No suitable format found for the specified quality");
		}

		// Stream the video
		ytdl(url, {
			format: videoFormat,
		}).pipe(res);
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
