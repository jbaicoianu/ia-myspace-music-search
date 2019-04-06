/*
 * Myspace Music Search
 * Written by James Baicoianu for the Internet Archive
 */
class MyspaceSearch extends HTMLElement {
  connectedCallback() {
    this.setAttribute('loading', true);
    this.entries = {};

    this.searchworker = new Worker('./src/search-worker-elasticlunr.js');
    this.searchworker.addEventListener('message', (ev) => this.handleWorkerMessage(ev));

    this.player = document.createElement('myspace-player');
    this.player.addEventListener('ended', (ev) => this.handlePlayerEnded(ev));
    this.appendChild(this.player);

    this.input = document.createElement('input');
    this.input.className = 'myspace-search-input';
    this.input.addEventListener('input', (ev) => this.handleInputInput(ev));
    this.input.addEventListener('keypress', (ev) => this.handleInputKeypress(ev));
    this.input.addEventListener('blur', (ev) => this.handleInputAccept(ev));
    this.input.placeholder = 'Search Myspace Music';
    this.appendChild(this.input);
    this.input.focus();

    this.resultsummary = document.createElement('h1');
    this.resultsummary.innerHTML = '<strong class="status">Loading data</strong> <myspace-search-spinner></myspace-search-spinner>';
    this.appendChild(this.resultsummary);

    this.results = document.createElement('myspace-search-list');

    window.addEventListener('popstate', (ev) => this.handlePopState(ev));
    this.handlePopState();

    this.documents = {};
    this.load('index.json').then(indices => {
      this.resultsummary.innerHTML = '<strong class="status">Generating index</strong> <myspace-search-spinner></myspace-search-spinner>';
      this.searchworker.postMessage({type: 'index', indices: indices});
    });
  }
  set metadata(v) {
    this.setAttribute('metadata', v);
  }
  get metadata() {
    return this.getAttribute('metadata');
  }
  load(file) {
    return fetch(file).then(d => d.json());
  }
  handleInputKeypress(ev) {
    console.log(ev);
    if (ev.key == 'Enter') {
      this.handleInputAccept(ev);
    }
  }
  handleInputInput(ev) {
    if (this.searchtimer) {
      clearTimeout(this.searchtimer);
    }
    this.searchtimer = setTimeout(() => {
      let value = this.input.value;
      if (value.length > 0) {
        this.search(value);
      } else {
        this.clear();
        this.resultsummary.innerHTML = '';
      }
    }, 100);
  }
  handleInputAccept(ev) {
console.log('input changed');
    let params = this.parseURLParams(document.location.search);
    if (params.q != this.input.value) {
console.log('do it');
      this.updateURL({q: this.input.value});
    }
  }
  search(query) {
    this.searchworker.postMessage({type: 'search', query: query});
  }
  clear() {
    if (this.results.parentNode === this) {
      this.removeChild(this.results);
    }
    this.results.innerHTML = '';
  }
  processResults(query, results) {
    this.clear();
    this.resultsummary.className = 'resultsummary';
    this.resultsummary.innerHTML = results.length + ' result' + (results.length != 1 ? 's' : '') + ' for <strong></strong>';
    this.resultsummary.getElementsByTagName('strong')[0].innerText = query;
    if (this.results.parentNode !== this) {
      this.appendChild(this.results);
    }
    results.forEach(res => {
      let entry = this.getEntry(res.ref);
      this.results.appendChild(entry);
    });
    if (this.selected) {
      this.select(this.selected);
    }
  }
  getDocument(id) {
    return this.documents[id];
  }
  getEntry(id) {
    if (this.entries[id]) {
      return this.entries[id];
    }

    let entries = this.results.childNodes;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].data.id == id) {
        return entries[i];
      }
    }
    // No entry found, create one
    let doc = this.getDocument(id);
    let entry = document.createElement('myspace-search-entry');
    entry.setData(doc);
    entry.addEventListener('select', (ev) => this.playSong(entry));
    this.entries[id] = entry;
    return entry;
  }
  playSong(entry) {
    this.select(entry);
    this.player.play(entry);
  }
  playNext() {
    let entries = this.results.getElementsByTagName('myspace-search-entry');
    let idx = Array.prototype.indexOf.apply(entries, [this.selected]);
    if (idx != -1) {
      let newidx = (idx + 1) % entries.length;
      this.playSong(entries[newidx]);
    }
  }
  playPrev() {
    let entries = this.results.childNodes;
    let idx = Array.prototype.indexOf.apply(entries, [this.selected]);
    if (idx != -1) {
      let newidx = (idx - 1 + entries.length) % entries.length;
      this.playSong(entries[newidx]);
    }
  }
  select(entry) {
    this.results.select(entry);
    if (!this.selected || entry !== this.selected) {
      this.selected = entry;
      this.updateURL({id: entry.data.id});
    }
  }
  handleWorkerMessage(ev) {
    if (ev.data.type == 'results') {
      this.processResults(ev.data.query, ev.data.results);
    } else if (ev.data.type == 'parsed') {
      this.documents = ev.data.documents;
      if (this.queuedsong) {
        let entry = this.getEntry(this.queuedsong);
        this.results.appendChild(entry);
        if (this.results.parentNode !== this) {
          this.appendChild(this.results);
        }
        this.playSong(entry);
        this.queuedsong = false;
      }
      this.removeAttribute('loading');
    } else if (ev.data.type == 'indexed') {
      this.resultsummary.innerHTML = '<strong class="status"><strong>';
    }
  }
  handlePlayerEnded(ev) {
    this.playNext();
  }
  getURLParams() {
    let params = {};
    if (this.input.value.length > 0) {
      params.q = this.input.value;
    }
    if (this.selected) {
      params.id = this.selected.data.id;
    } else if (this.queuedsong) {
      params.id = this.queuedsong;
    }
    return params;
  }
  updateURL(params) {
    let current = this.getURLParams();
    for (let k in params) {
      current[k] = params[k];
    }
    let old = this.parseURLParams(document.location.search);
    if (old.id != current.id || old.q != current.q) {
      history.pushState({}, '', this.getURL(current));
    }
  }
  getURL(params) {
    let url = document.location.pathname;
    let sep = '?';
    for (let k in params) {
      url += sep + k + '=' + encodeURIComponent(params[k]);
      sep = '&';
    }
    return url;
  }
  parseURLParams(str) {
    if (str[0] == '?') str = str.substr(1);
    let parts = str.split('&');
    let params = {};
    parts.forEach(p => {
      let keyval = p.split('=');
      params[keyval[0]] = decodeURIComponent(keyval[1]);
    });
    return params;
  }
  handlePopState(ev) {
    let urlparams = this.parseURLParams(document.location.search);
    if (urlparams.q && this.input.value != urlparams.q) {
      this.input.value = urlparams.q;
      this.search(urlparams.q);
    }
console.log(urlparams, this.selected);
    if (urlparams.id && (!this.selected || (this.selected && this.selected.data.id != urlparams.id))) {
      this.queuedsong = urlparams.id;
      if (this.documents) {
        this.playSong(this.getEntry(urlparams.id));
      } else {
        this.queuedsong = urlparams.id;
      }
      this.updateURL({id: this.queuedsong});
    }
  }
}
class MyspaceSearchList extends HTMLElement {
  select(entry) {
    let entries = this.getElementsByTagName('myspace-search-entry');
    for (let i = 0; i < entries.length; i++) {
      if (entries[i] === entry) {
        entries[i].select();
      } else {
        entries[i].deselect();
      }
    }
    if (entry.scrollIntoViewIfNeeded) {
      entry.scrollIntoViewIfNeeded();
    } else {
      entry.scrollIntoView();
    }
  }
}
class MyspaceSearchEntry extends HTMLElement {
  constructor() {
    super();

    this.playlink = document.createElement('a');
    this.playlink.className = 'play';
    this.playlink.href = '#';

    this.downloadlink = document.createElement('a');
    this.downloadlink.className = 'download';
    this.downloadlink.innerText = 'Download';
    this.downloadlink.href = '#';

    this.playlink.addEventListener('click', (ev) => this.handlePlayClick(ev));
    this.downloadlink.addEventListener('click', (ev) => this.handleDownloadClick(ev));

  }
  connectedCallback() {
    this.addEventListener('click', (ev) => this.handleClick(ev));

    this.appendChild(this.playlink);
    this.appendChild(this.downloadlink);
  }
  setData(data) {
    this.data = data;
    //this.innerHTML = data.username + ' - ' + data.title;
    this.playlink.innerText = data.username + ' - ' + data.title;
  }
  fetchMetadata() {
    if (this.archiveurl) {
      // We've already fetched our metadata, reurn a promise which immediately completes with the cached URL
      return new Promise((accept, reject) => { accept(this.archiveurl); });
    }
    // Use HTTP Range header to fetch only the specific row we need from the servers
    let headers = new Headers();
    headers.append('Range', 'bytes=' + this.data.offset + '-' + (this.data.offset + this.data.length));
    let metadataurl = this.getSearch().metadata;
    return fetch(metadataurl, {headers: headers}).then(d => d.text()).then(t => this.parseMetadata(t));
  }
  parseMetadata(tsv) {
    return new Promise((accept, reject) => {
      let fields = tsv.split('\t');
      this.url = fields[8];
      let urlparts = this.url.split('/');
      let collection = urlparts[3],
          fname = urlparts[4];

      let archiveurl = 'https://archive.org/download/myspace_dragon_hoard_2010/' + collection + '.zip/' + collection + '%2F' + fname;
      this.archiveurl = archiveurl;
      accept(archiveurl);
    }); 
  }
  getArchiveURL() {
    return this.fetchMetadata();
  }
  getSearch() {
    let node = this.parentNode;
    while (node) {
      if (node instanceof MyspaceSearch) {
        return node;
      }
      node = node.parentNode;
    }
    // Fall back on the first myspace-search instance in the document, if I don't have a matching parent
    let search = document.querySelector('myspace-search');
    return search;
    //throw 'MyspaceSearchEntry has no parent search';
  }
  handleClick(ev) {
    this.dispatchEvent(new CustomEvent('select'));
  }
  select() {
    this.setAttribute('selected', true);
  }
  deselect() {
    this.removeAttribute('selected');
  }
  handlePlayClick(ev) {
    ev.preventDefault();
  }
  handleDownloadClick(ev) {
    this.getArchiveURL().then(url => {
      let link = document.createElement('a');
      document.body.appendChild(link);
      link.href = url;
      link.download = this.data.username + ' - ' + this.data.title + '.mp3';
      link.click();
console.log(link);
      document.body.removeChild(link);
    });
    ev.stopPropagation();
    ev.preventDefault();
  }
};
let tpl = `
  <myspace-player>
    <myspace-player-controls></myspace-player-controls>
    <myspace-player-volume></myspace-player-volume>
    <myspace-player-info></myspace-player-info>
    <myspace-player-seekbar></myspace-player-seekbar>
  </myspace-player>
`;
class MyspacePlayer extends HTMLElement {
  connectedCallback() {
    this.audio = document.createElement('audio');
    this.audio.addEventListener('durationchange', (ev) => this.updateSeekbar());
    this.audio.addEventListener('play', (ev) => this.setStatus('playing'));
    this.audio.addEventListener('abort', (ev) => this.setStatus('stopped'));
    this.audio.addEventListener('ended', (ev) => { this.setStatus('stopped'); this.dispatchEvent(new CustomEvent('ended')); });
    this.audio.addEventListener('pause', (ev) => this.setStatus('paused'));
    this.audio.addEventListener('timeupdate', (ev) => this.updateSeekbar());

    this.controls = document.createElement('myspace-player-controls');
    this.volume = document.createElement('myspace-player-volume');
    this.info = document.createElement('myspace-player-info');
    this.seekbar = document.createElement('myspace-player-seekbar');
    this.seekbar.addEventListener('seek', (ev) => { this.seekTo(parseFloat(ev.detail.value)); });

    this.appendChild(this.audio);
    this.appendChild(this.controls);
    this.appendChild(this.info);
    this.appendChild(this.volume);
    this.appendChild(this.seekbar);

    this.setStatus('stopped');

  }
  play(entry) {
    this.info.setData(entry.data);
    entry.getArchiveURL().then(url => {
      this.audio.src = url;
      this.audio.play();
    });
  }
  setStatus(status) {
    this.setAttribute('status', status);
  }
  seekTo(time) {
    this.audio.currentTime = time;
  }
  handleLoadedMetadata(ev) {
    this.updateSeekbar();
  }
  updateSeekbar() {
    if (this.audio) {
      this.seekbar.update(this.audio);
    }
  }
}

class MyspacePlayerInfo extends HTMLElement {
  connectedCallback() {
    this.displaytitle = document.createElement('h1');
    this.displayartist = document.createElement('h2');

    this.appendChild(this.displaytitle);
    this.appendChild(this.displayartist);

    this.spectrum = document.createElement('img');
    this.spectrum.className = 'player_spectrum';
    this.spectrum.src = 'data/spectrum.gif';
    this.appendChild(this.spectrum);
  }
  setData(data) {
    this.displaytitle.innerText = data.title;
    this.displayartist.innerText = data.username;
  }
}
class MyspacePlayerControls extends HTMLElement {
  connectedCallback() {
    this.stopbutton = document.createElement('button');
    this.stopbutton.name = 'stop';
    this.stopbutton.className = 'fa fa-stop';
    this.backbutton = document.createElement('button');
    this.backbutton.name = 'back';
    this.backbutton.className = 'fa fa-step-backward';
    this.pausebutton = document.createElement('button');
    this.pausebutton.name = 'pause';
    this.pausebutton.className = 'fa fa-pause';
    this.playbutton = document.createElement('button');
    this.playbutton.name = 'play';
    this.playbutton.className = 'fa fa-play';
    this.fwdbutton = document.createElement('button');
    this.fwdbutton.name = 'forward';
    this.fwdbutton.className = 'fa fa-step-forward';

    this.appendChild(this.stopbutton);
    this.appendChild(this.backbutton);
    this.appendChild(this.pausebutton);
    this.appendChild(this.playbutton);
    this.appendChild(this.fwdbutton);

    this.audio = this.parentNode.audio;
    // FIXME - should be handled by dispatching events and letting the parents respond
    this.backbutton.addEventListener('click', (ev) => this.parentNode.parentNode.playPrev());
    this.fwdbutton.addEventListener('click', (ev) => this.parentNode.parentNode.playNext());
    this.playbutton.addEventListener('click', (ev) => this.audio.play());
    this.pausebutton.addEventListener('click', (ev) => this.audio.pause());
    this.stopbutton.addEventListener('click', (ev) => { this.audio.pause(); this.parentNode.seekTo(0); setTimeout(() => this.parentNode.setStatus('stopped'), 10); });
  }
}
class MyspacePlayerSeekbar extends HTMLElement {
  connectedCallback() {
    this.currenttime = document.createElement('input');
    this.currenttime.value = this.formatTime(0);

    this.bar = document.createElement('input');
    this.bar.type = 'range';
    this.bar.min = 0;
    this.bar.max = 1;

    this.bar.addEventListener('mousedown', (ev) => this.handleSeekMousedown(ev));
    this.bar.addEventListener('mouseup', (ev) => this.handleSeekMousedown(ev));
    this.bar.addEventListener('input', (ev) => this.handleSeekInput(ev));
    this.bar.addEventListener('change', (ev) => this.handleSeekChange(ev));

    this.duration = document.createElement('input');
    this.duration.value = this.formatTime(0);

    this.appendChild(this.currenttime);
    this.appendChild(this.bar);
    //this.appendChild(this.duration);
  }
  update(audio) {
    this.currenttime.value = this.formatTime(audio.currentTime);
    if (!this.seeking) {
      this.bar.value = audio.currentTime;
      this.bar.max = audio.duration;
    }
    this.duration.value = this.formatTime(audio.duration || 0);
  }
  formatTime(time) {
    let seconds = Math.floor(time % 60),
        minutes = Math.floor(time / 60);
    return minutes.toString().padStart(2, 0) + ':' + seconds.toString().padStart(2, 0);
  }
  handleSeekMousedown(ev) {
    this.seeking = true;
  }
  handleSeekMouseup(ev) {
    this.seeking = false;
  }
  handleSeekChange(ev) {
    this.seeking = false;
  }
  handleSeekInput(ev) {
    //this.audio.currentTime = this.bar.value;
    this.dispatchEvent(new CustomEvent('seek', {detail: {value: this.bar.value}}));
  }
}
class MyspacePlayerVolume extends HTMLElement {
  connectedCallback() {
    this.icon = document.createElement('div');
    this.icon.className = 'fa fa-volume-up';
    this.appendChild(this.icon);

    this.bar = document.createElement('input');
    this.bar.type = 'range';
    this.bar.min = 0;
    this.bar.max = 100;

    this.bar.addEventListener('mousedown', (ev) => this.handleVolumeMousedown(ev));
    this.bar.addEventListener('mouseup', (ev) => this.handleVolumeMousedown(ev));
    this.bar.addEventListener('input', (ev) => this.handleVolumeInput(ev));
    this.bar.addEventListener('change', (ev) => this.handleVolumeChange(ev));

    this.appendChild(this.bar);
  }
  handleVolumeMousedown(ev) {
  }
  handleVolumeMouseup(ev) {
  }
  handleVolumeInput(ev) {
    this.parentNode.audio.volume = (this.bar.value / 100);
  }
  handleVolumeChange(ev) {
  }
}

class MyspaceSearchSpinner extends HTMLElement {
}

customElements.define('myspace-search', MyspaceSearch);
customElements.define('myspace-search-list', MyspaceSearchList);
customElements.define('myspace-search-entry', MyspaceSearchEntry);
customElements.define('myspace-player', MyspacePlayer);
customElements.define('myspace-player-info', MyspacePlayerInfo);
customElements.define('myspace-player-controls', MyspacePlayerControls);
customElements.define('myspace-player-seekbar', MyspacePlayerSeekbar);
customElements.define('myspace-player-volume', MyspacePlayerVolume);
customElements.define('myspace-search-spinner', MyspaceSearchSpinner);
