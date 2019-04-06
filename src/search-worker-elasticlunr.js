importScripts('../external/elasticlunr.min.js');

class SearchWorker {
  constructor() {
    this.docid = 1;
    console.log('[search-worker] Initialize SearchWorker (elasticlunr)');
  }
  parseData(data) {
if (this.searchindex) return;
    let self = this;
    console.log('[search-worker] indexing data');
    this.searchindex = elasticlunr(function() {
      this.addField('title');
      this.addField('username');
      this.setRef('id');
      this.saveDocument(false);
    });
      //self.indexer = this;
    let documents = {};
    data.forEach(d => {
      if (!d) return;
      let doc = {
        id: self.docid++,
        title: d[0],
        username: d[1],
        offset: d[2],
        length: d[3],
      };
      documents[doc.id] = doc;
    });
    console.log('[search-worker] documents parsed, indexing...');
    postMessage({type: 'parsed', documents: documents});


    for (let id in documents) {
      this.searchindex.addDoc(documents[id]);
    }
    console.log('[search-worker] indexing complete');
    postMessage({type: 'indexed'});
    if (this.queuedquery) {
      setTimeout(() => {
        this.search(this.queuedquery);
      }, 0);
    }
  }
  loadCachedIndex(indexstr) {
    this.searchindex = lunr(function() {
      this.ref('id');
      this.field('title');
      this.field('username');
      self.indexer = this;
      //console.log('[search-worker] Indexer ready for indexing', self.indexer);
    });
    this.searchindex.load(JSON.parse(indexstr));
    console.log('[search-worker] Cached index loaded');
  }
  search(query) {
    if (!this.searchindex) {
      this.queuedquery = query;
      console.log('[search-worker] delaying search until indexing is complete');
      return;
    }
    console.log('[search-worker] performing search...', this.searchindex);
    let results = this.searchindex.search(query);
    console.log('[search-worker] got results');
    postMessage({type: 'results', query: query, results: results});
  }
}

let worker = new SearchWorker();

onmessage = function(ev) {
  if (ev.data.type == 'index') {
    worker.parseData(ev.data.indices);
  } else if (ev.data.type == 'cachedindex') {
    worker.loadCachedIndex(ev.data.cache);
  } else if (ev.data.type == 'search') {
    worker.search(ev.data.query);
  }
}

