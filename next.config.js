/** @type {import('next').NextConfig} */
module.exports = {
  outputFileTracingIncludes: {
    '/api/social/media': ['./node_modules/ffmpeg-static/ffmpeg'],
    '/api/social/video': ['./node_modules/ffmpeg-static/ffmpeg'],
  },
};
