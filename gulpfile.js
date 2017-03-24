var p = require('./package.json'),
gulp = require('gulp'),
newer = require('gulp-newer'),
sass = require('gulp-sass'),
imagemin = require('gulp-imagemin'),
del = require('del'),
remarkable = require('gulp-remarkable'),
hljs = require('highlight.js'),
nunjucks = require('nunjucks'),
toc = require('markdown-toc'),
through = require("through2"),
pdf = require('gulp-html-pdf'),
cheerio = require('cheerio'),
path = require('path');

var basePath = path.resolve(__dirname, '');


var conf = {
	sass: 'src/scss/**/*.scss',
	template: 'src/templates/layout.html',
	stylesheet: 'default.css',
	documents: 'src/markdown/*.md',
	images: 'src/images/**/*',
	build: 'build/'
};

var renderTOC = through.obj(function (chunk, enc, callback) {
	var md = chunk._contents.toString('utf8');
	var toclist = toc(md).content;
	md = md.replace('[TOC]', toclist);
	chunk._contents = new Buffer(md, 'utf8');
	this.push(chunk);
	callback();
});

var renderHTML = through.obj(function (chunk, enc, callback) {
	var md = chunk._contents.toString('utf8');
	var result = nunjucks.render(conf.template, {
		stylesheet: conf.stylesheet,
	 	content: md
	});

	var $ = cheerio.load(result);

	$('img[src]').each(function () {
		var imagePath = $(this).attr('src');
		imagePath = path.resolve(basePath, imagePath);
		$(this).attr('src', 'file://' + (process.platform === 'win32' ? '/' : '') + imagePath);
	});

	result = $.html();

	chunk._contents = new Buffer(result, 'utf8');
	//console.log(JSON.stringify(md, null, 4));
	this.push(chunk);
	callback();
})

gulp.task('clean', function() {
	return del.sync(['./build/**']);
});

// Copy all static images
gulp.task('images', function() {
	var imgDest = conf.build + '/images';
	return gulp.src(conf.images)
		.pipe(newer(imgDest))
		.pipe(imagemin({optimizationLevel: 5}))
		.pipe(gulp.dest(imgDest));
});

gulp.task('sass', function () {
	var sassDest = conf.build + '/css';
	gulp.src(conf.sass)
		.pipe(newer(sassDest))
		.pipe(sass({
			outputStyle: 'compressed'
		}))
		.pipe(gulp.dest(sassDest))
});


gulp.task('documents', ['staticfiles'], function() {
	gulp.src(conf.documents)
		.pipe(renderTOC)
		.pipe(remarkable({
			preset: 'full',
			linkify: true,
			typographer:  true,
			quotes: '„“‘’',
			syntax: ['abbreviations', 'footnotes'],
			plugins: [require('remarkable-classy')]
		}))
		.pipe(renderHTML)
		.pipe(gulp.dest(conf.build))
		.pipe(pdf({
			"format": "A4",
			"border": {
				"top": "1cm",      // default is 0, units: mm, cm, in, px
				"right": "1cm",
				"bottom": ".5mm",
				"left": "1.5cm"
			},
			"header": {
				"height": "15mm",
				"contents": '<header style="text-align: center;">Author: ' + p.author + '</header>'
			},
			"footer": {
				"height": "15mm",
				"contents": '<footer style="margin-top:1cm;color:#444;font-size:90%;">Page: {{page}}</span>/<span>{{pages}}</footer>'
			},
			"phantomArgs": []
		}))
		.pipe(gulp.dest(conf.build + 'pdf/'));
});

gulp.task('watch', function() {
	gulp.watch([conf.documents + '*.md'], ['documents']);
	gulp.watch(conf.sass, ['sass']);
});

gulp.task('staticfiles', ['sass', 'images']);

gulp.task('build', ['documents']);
gulp.task('default', ['build', 'watch']);
