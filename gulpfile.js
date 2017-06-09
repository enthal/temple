const gulp = require('gulp');
const temple = require('./index').gulp;

gulp.task('default', () =>
  gulp.src('./example/templates/*.html')
    .pipe(temple('./example/content.yml'))
      .on('error', console.log)
    .pipe(gulp.dest('out'))
);
