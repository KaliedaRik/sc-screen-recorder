# Scrawl-canvas screen recorder
Record your local screen using your browser.

This is a proof-of-concept project. Feel free to fork-and-amend to suit your own requirements!

## Development
1. Fork or clone this repo
2. Navigate to the downloaded folder
3. Don't bother installing anything - there's no build chain because: it's just a web page
4. Start a local server to serve the page locally - for example, [live-server](https://github.com/tapio/live-server) seems to do a decent job.
5. Hack away!

### Key files
The page's HTML code can be found in the  in the `index.html` file, while the CSS code lurks in the `index.css` file.

The page functionality currently lives in the `index.html` file. I'll probably move this to its own `index.js` file at some point. Though there's no rush ...

The code relies on the [Scrawl-canvas](https://github.com/KaliedaRik/Scrawl-canvas) library, the minified version of which can be found in the `js/scrawl-canvas.js` file. There's no tool chain, so updating SC to its latest version means grabbing the latest minified version of the file and slapping it into the `js/` folder.
