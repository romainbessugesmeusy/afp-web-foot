'use strict';

var gulp = require('gulp');
var stylus = require('gulp-stylus');
var autoprefixer = require('gulp-autoprefixer');
var gulpHandlebars = require('gulp-handlebars');
var wrap = require('gulp-wrap');
var declare = require('gulp-declare');
var concat = require('gulp-concat');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var merge = require('merge-stream');
var path = require('path');
var async = require('async');
var glob = require('glob');

function onError(err) {
    console.log(err);
    this.emit('end');
}

gulp.task('javascript', ['handlebars'], function () {
    // set up the browserify instance on a task basis
    var b = browserify({
        entries: 'src/app/index.js',
        debug: true
    });

    b.ignore('canvas');


    return b.bundle()
        .pipe(source('app.js'))
        .pipe(buffer())
        //.pipe(sourcemaps.init({loadMaps: true}))
        // Add transformation tasks to the pipeline here.
        //.pipe(uglify())
        .on('error', onError)
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('./dist/js/'));
});

gulp.task('stylus', function () {
    gulp.src('./src/stylus/main.styl')
        .pipe(stylus({
            compress: true,
            'include css': true
        }))
        .pipe(autoprefixer({
            browsers: ['last 2 versions'],
            cascade: false
        }))
        .pipe(gulp.dest('./dist/css'))
        .on('error', onError);
});

gulp.task('client-stylus', function (cb) {
    glob(__dirname + '/dist/data/clients/**/client.styl', function (err, files) {
        async.forEach(files, function (filename, fileCb) {
            gulp.src(filename)
                .pipe(stylus({
                    compress: true,
                    'include css': true
                }))
                .pipe(autoprefixer({
                    browsers: ['last 2 versions'],
                    cascade: false
                }))
                .pipe(gulp.dest(path.dirname(filename)))
                .on('error', onError)
                .on('end', fileCb);
        }, cb)
    });
});

gulp.task('hbsViews', function () {
    return gulp.src('src/handlebars/views/**/*.hbs')
        .on('error', onError)
        // Compile each Handlebars template source file to a template function
        .pipe(gulpHandlebars({handlebars: require('./src/handlebars/customHelpers')}))
        // Wrap each template function in a call to Handlebars.template
        .pipe(wrap('Handlebars.template(<%= contents %>)'))
        // Declare template functions as properties and sub-properties of exports
        .pipe(declare({
            root: 'exports',
            noRedeclare: true, // Avoid duplicate declarations
            processName: function (filePath) {
                // Allow nesting based on path using gulp-declare's processNameByPath()
                // You can remove this option completely if you aren't using nested folders
                // Drop the templates/ folder from the namespace path by removing it from the filePath
                return declare.processNameByPath(filePath.replace('src/handlebars/views/', ''));
            }
        }))
        // Concatenate down to a single file
        .pipe(concat('views.js'))
        // Add the Handlebars module in the final output
        .pipe(wrap('var Handlebars = require("../handlebars/customHelpers");\n <%= contents %>'))
        // WRite the output into the templates folder
        .pipe(gulp.dest('src/gen'));
});

gulp.task('hbsPartials', function () {
    return gulp.src(['src/handlebars/partials/**/*.hbs'])
        .on('error', onError)
        .pipe(gulpHandlebars({handlebars: require('handlebars')}))
        .pipe(wrap('Handlebars.registerPartial(<%= processPartialName(file.relative) %>, Handlebars.template(<%= contents %>));', {}, {
            imports: {
                processPartialName: function (fileName) {
                    // Strip the extension and the underscore
                    // Escape the output with JSON.stringify
                    return JSON.stringify(path.basename(fileName, '.js'));
                }
            }
        }))
        .pipe(concat('partials.js'))
        .pipe(wrap('var Handlebars = require("../handlebars/customHelpers");\n <%= contents %>\n module.exports = Handlebars;'))
        .pipe(gulp.dest('src/gen'));
});

gulp.task('handlebars', ['hbsViews', 'hbsPartials']);

gulp.task('locale', function () {
    return gulp.src('')
});

gulp.task('watch', function () {
    gulp.watch(['./src/app/**/*.js'], ['javascript']);
    gulp.watch(['./src/stylus/**/*.styl'], ['stylus']);
    gulp.watch(['./dist/data/clients/**/*.styl'], ['client-stylus']);
    gulp.watch(['./src/handlebars/**/*.hbs'], ['javascript']);
    gulp.watch(['./src/handlebars/customHelpers.js'], ['javascript']);
});

gulp.task('default', ['javascript', 'client-stylus', 'stylus', 'watch']);