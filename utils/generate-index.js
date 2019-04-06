/*
[[author, title, byteoffset, length], [author, title, byteoffset, length], ...]
*/

let fs = require('fs');
let fname = 'metadata.tsv';
let idxfile = 'index.json';
const bufsize = 8192;

/*
fs.stat(fname, (stat) => {
  let size = stat.size;
  fs.open(fname, 'r', (file) => {
    for (let offset = 0; offset < size; offset += bufsize) {
      let buf = fs.readSync(file, 
    }
  } 
})
*/
fs.open(idxfile, 'w', (err, idxfd) => {
  fs.writeSync(idxfd, '[null');
  fs.readFile(fname, {}, (err, data) => {
    console.log('got file', fname, data);
    let offset = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] == 13) {
        generateIndex(idxfd, data, offset, i);
        offset = i+2;
      }
    }
    fs.writeSync(idxfd, ']');
  });
});

function generateIndex(idxfd, data, start, end) {
  let line = data.toString('utf8', start, end);
  let parts = line.split('\t');
/*
  let data = {
    id: parts[0],
    title: parts[1],
    userid: parts[2],
    username: parts[3],
    userurl: parts[4],
    //unknown1: parts[5],
    //myspace: parts[6],
    //unknown2: parts[7],
    url: parts[8],
  };
*/
  let mp3url = parts[8],
      urlparts = mp3url.split('/');
  
  let collection = urlparts[3];
  //if ((collection >= 10 && collection < 61) ||
  //    (collection >= 90 && collection < 145)) {
    let idx = [parts[1], parts[3], start, end - start];
    //console.log('new line:', JSON.stringify(idx));
    //idxfd.write(idx);
    fs.writeSync(idxfd, ',' + JSON.stringify(idx));
  //} 
}
