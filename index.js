const hash = (() => {
  class Hash extends Map {
    constructor() {
      super();
      this.read();
      window.addEventListener('hashchange', () => {
        if (this.ignore) {
          --this.ignore;
        } else {
          this.read();
          this.callCallbacks();
        }
      }, { passive: true });
    }

    cache = '';

    ignore = 0;

    callbacks = new Set();

    addCallback(cb) {
      this.callbacks.add(cb);
      return this;
    }

    hasCallback(cb) {
      return this.callbacks.has(cb);
    }

    delCallback(cb) {
      return this.callbacks.delete(cb);
    }

    callCallbacks() {
      this.callbacks.forEach((cb) => { cb(); });
    }

    read() {
      const str = window.location.hash.substring(1);
      if (this.cache === str) return;
      super.clear();
      if (!str) return;
      const pairs = str.split('&');
      pairs.forEach((entry) => {
        super.set(...entry.split('-', 2));
      });
      this.cache = str;
      this.write();
    }

    write() {
      let str = '';
      const pairs = [...super.entries()];
      pairs.sort((a, b) => (a[0] > b[0] ? 1 : -1));
      pairs.forEach(([key, value]) => {
        if (str) str += '&';
        str += `${key}`;
        if (typeof value !== 'undefined') str += `-${value}`;
      });
      if (str !== this.cache) {
        this.cache = str;
        ++this.ignore;
        window.location.hash = str;
      }
    }

    has(key) {
      if (key === 'id') return super.has('serial') || super.has('move');
      return super.has(key);
    }

    get(key) {
      if (key === 'id') {
        if (super.has('serial')) return `serial-${super.get('serial')}`;
        if (super.has('move')) return `move-${super.get('move')}`;
      }
      return super.get(key);
    }

    set(key, value) {
      if (key === 'id') {
        if (typeof value !== 'string') return this;
        if (value.indexOf('serial-') === 0) {
          super.delete('move');
          super.set('serial', value.substring(7));
          this.write();
        } else if (value.indexOf('move-') === 0) {
          super.delete('serial');
          super.set('move', value.substring(5));
          this.write();
        }
        return this;
      }
      super.set(key, value);
      this.write();
      return this;
    }

    delete(key) {
      const r = key === 'id' ? super.delete('serial') || super.delete('move') : super.delete(key);
      if (r) this.write();
      return r;
    }

    clear() {
      const bg = super.get('bg');
      super.clear();
      if (this.cache !== '') {
        this.cache = '';
        ++this.ignore;
        window.location.hash = '';
      }
      if (bg) this.set('bg', bg);
    }
  }
  return new Hash();
})();

let items = new Map();

const parse = (results) => {
  const its = new Map();
  const keyTypes = ['worldart_link', 'shikimori_id', 'kinopoisk_id', 'imdb_id', 'mdl_id'];
  results.forEach((r) => {
    const keyType = keyTypes.find((ktype) => r[ktype]);
    const key = keyType ? `${keyType}-${r[keyType]}` : `tyt-${r.type}${r.year}${r.title_orig}`;
    if (!its.has(key)) {
      const img = r.material_data?.anime_poster_url || r.material_data?.poster_url || 'no-img.jpg';
      its.set(key, {
        key, img, y: r.year, ep: r.last_episode, top: r, raw: new Map(), tr: new Map(),
      });
    } else if (its.get(key).top.last_episode < r.last_episode) {
      its.get(key).top = r;
      its.get(key).ep = r.last_episode;
    }
    its.get(key).raw.set(r.id, r);
    its.get(key).tr.set(r.translation.id, r.id);
  });
  return its;
};

const buildString = (item) => {
  const { top } = item;
  let string = '';
  if (item.y) string += `${item.y}г. `;
  if (item.ep) string += `${item.ep} эп. `;
  let str = '';
  item.raw.forEach((r) => {
    if (str !== '') str += ', ';
    if (r === top) str += `<span class="underline">${r.translation.title}</span>`;
    else str += r.translation.title;
    if (r.last_episode) str += `[${r.last_episode}]`;
  });
  return string + str;
};

const buildLinks = (top) => {
  const links = [];
  const buildRate = (r) => (r ? ` ${r}` : '');
  if (top.shikimori_id) {
    const r8 = buildRate(top.material_data?.shikimori_rating);
    links.push(`<a href="https://shikimori.one/animes/${top.shikimori_id}" target="_blank" rel="noreferrer">shikimori${r8}</a>`);
  }
  if (top.worldart_link) {
    links.push(`<a href="${top.worldart_link}" target="_blank" rel="noreferrer">worldart</a>`);
  }
  if (top.kinopoisk_id) {
    const r8 = buildRate(top.material_data?.kinopoisk_rating);
    links.push(`<a href="https://www.kinopoisk.ru/film/${top.kinopoisk_id}" target="_blank" rel="noreferrer">kinopoisk${r8}</a>`);
  }
  if (top.imdb_id) {
    const r8 = buildRate(top.material_data?.imdb_rating);
    links.push(`<a href="https://www.imdb.com/title/${top.imdb_id}" target="_blank" rel="noreferrer">imdb${r8}</a>`);
  }
  return links.join(', ');
};

const buildHTML = (its) => {
  let html = '';
  its.forEach((item, key) => {
    const { top } = item;
    html += `<div class="item" data-key="${key}">
<div class="left">
<div class="poster-wrapper">
  <img class="poster" src="${item.img}" alt="" />
</div>
<div class="info">
  <p class="title">${top.title ?? ''}</p>
  <p class="titleOrig">${top.title_orig ?? ''}</p>
  <p class="titleOther">${top.other_title ?? ''}</p>
  <p class="links">${buildLinks(top)}</p>
  <p class="string">${buildString(item)}</p>
</div>
</div>
<div class="right">
<button class="right-button iframe-button">▷</button>
<button class="right-button json-button">JSON</button>
</div>
</div>`;
  });
  return html;
};

const sendQuery = async (query) => {
  const status = document.getElementById('status');
  const baseURL = 'https://api.andb.workers.dev/';
  const searchStartTime = Date.now();
  status.textContent = 'Поиск…';
  status.style.display = 'block';
  const res = await fetch(`${baseURL}${query}&with_material_data=true`);
  const resJson = await res.json();
  const { results } = resJson;
  const searchTime = Date.now() - searchStartTime;
  if (!results || results.length === 0) {
    status.textContent = `Ничего не найдено (${searchTime / 1000} сек.)`;
    if (resJson.error) console.log(resJson.error);
    return [[], searchTime];
  }
  return [results, searchTime];
};

{ // newButton click
  const newButton = document.getElementById('new-button');
  newButton.addEventListener('click', async () => {
    const queryParam = 'types=anime,anime-serial&limit=100';
    hash.clear();
    hash.set('new');
    const list = document.getElementById('list');
    const status = document.getElementById('status');
    list.style.display = 'none';
    const [results, searchTime] = await sendQuery(`list?${queryParam}`);
    if (results.length === 0) return;
    items = new Map([...parse(results.reverse())].reverse());
    status.textContent = `Найдено: ${items.size} [${results.length}] (${(searchTime) / 1000} сек.)`;
    list.innerHTML = buildHTML(items);
    list.style.display = 'block';
    const iframe = document.getElementById('iframe');
    iframe.dataset.key = '';
  }, { passive: true });
}

{ // searchForm submit
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');

  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { id, shikimoriId } = e.detail || { id: null, shikimoriId: null };
    const someId = !!id || !!shikimoriId;
    const query = searchInput.value;
    if (!someId && query === '') return;
    if (!someId) hash.clear();
    const list = document.getElementById('list');
    const status = document.getElementById('status');
    list.style.display = 'none';
    let queryParam = '';
    if (shikimoriId) {
      queryParam = `shikimori_id=${encodeURI(shikimoriId)}`;
    } else if (id) {
      queryParam = `id=${encodeURI(id)}`;
    } else if (query.includes('http://www.world-art.ru/cinema/cinema.php?id=')
      || query.includes('http://www.world-art.ru/animation/animation.php?id=')) {
      queryParam = `worldart_link=${encodeURI(query)}`;
    } else {
      queryParam = `title=${encodeURI(query)}`;
    }
    const [results, searchTime] = await sendQuery(`search?${queryParam}`);
    if (results.length === 0) return;
    items = parse(results);
    if (id && results.length > 1) {
      const [[, item]] = items;
      if (item.raw.has(id)) item.top = item.raw.get(id);
    }
    status.textContent = `Найдено: ${items.size} [${results.length}] (${(searchTime) / 1000} сек.)`;
    list.innerHTML = buildHTML(items);
    list.style.display = 'block';
    const iframe = document.getElementById('iframe');
    iframe.dataset.key = '';
  });
}

{ // list click
  const list = document.getElementById('list');
  const json = document.getElementById('json');
  const iframe = document.getElementById('iframe');
  const jsonOverlay = document.getElementById('json-overlay');
  const iframeOverlay = document.getElementById('iframe-overlay');
  list.addEventListener('click', ({ target }) => {
    const { className } = target;
    if (!className.includes('iframe-button') && !className.includes('json-button')) return;
    const elemet = target.parentElement.parentElement;
    const { key } = elemet.dataset;
    const item = items.get(key);
    const { top } = item;
    if (className.includes('iframe-button')) {
      if (iframe.dataset.key !== key) {
        iframe.src = top.link;
        iframe.dataset.key = key;
        hash.delete('new');
        hash.delete('ep');
        hash.set('shikimori', top.shikimori_id);
        hash.set('id', top.id);
        const prevElement = document.querySelector('.item.current');
        if (prevElement !== elemet) {
          if (prevElement) prevElement.classList.remove('current');
          elemet.classList.add('current');
        }
      }
      iframeOverlay.style.display = 'block';
    } else if (className.includes('json-button') && items.size) {
      json.textContent = JSON.stringify(items.get(key), (k, v) => (v instanceof Map ? [...v.entries()] : v), '  ');
      jsonOverlay.style.display = 'block';
    }
  }, { passive: true });
}

{ // iframeOverlay click
  const iframeOverlay = document.getElementById('iframe-overlay');
  const iframe = document.getElementById('iframe');
  iframeOverlay.addEventListener('click', ({ target }) => {
    if (target === iframeOverlay) {
      iframeOverlay.style.display = 'none';
      iframe.contentWindow.postMessage({ key: 'kodik_player_api', value: { method: 'pause' } }, '*');
    }
  }, { passive: true });
}

{ // jsonOverlay click
  const jsonOverlay = document.getElementById('json-overlay');
  jsonOverlay.addEventListener('click', ({ target }) => {
    if (target === jsonOverlay) {
      jsonOverlay.style.display = 'none';
    }
  }, { passive: true });
}

{ // update hash and page title by message from iframe
  const iframe = document.getElementById('iframe');
  window.addEventListener('message', ({ data }) => {
    const { key } = iframe.dataset;
    if (data?.key === 'kodik_player_current_episode') {
      const item = items.get(key);
      if (item?.tr.has(data.value.translation.id)) {
        const id = item.tr.get(data.value.translation.id);
        item.top = item.raw.get(id);
        hash.set('id', id);
        if (data.value.episode) {
          hash.set('ep', data.value.episode);
          document.title = `(${data.value.episode}) ${item.top.title}`;
        } else {
          hash.delete('ep');
          document.title = item.top.title;
        }
        const elemet = document.querySelector(`.item[data-key="${key}"] .string`);
        elemet.innerHTML = buildString(item);
      }
    }
  }, { passive: true });
}

const backgroundCount = 3;

{ // backgroundButton click
  const background = document.getElementById('background');
  const backgroundButton = document.getElementById('background-button');
  backgroundButton.addEventListener('click', () => {
    let index = Math.abs(Number.parseInt(hash.get('bg'), 10)) || 0;
    index = (index + 1) % backgroundCount;
    background.src = `wallpaper/${index}.mp4`;
    if (index === 0) hash.delete('bg');
    else hash.set('bg', index);
  }, { passive: true });
}

{ // hashchange callback
  const background = document.getElementById('background');
  const newButton = document.getElementById('new-button');
  const iframe = document.getElementById('iframe');
  const searchForm = document.getElementById('search-form');
  hash.addCallback(() => {
    const bg = Math.abs(Number.parseInt(hash.get('bg'), 10)) || 0;
    const index = bg % backgroundCount;
    const newSrc = `wallpaper/${index}.mp4`;
    if (newSrc.slice(-15) !== background.src.slice(-15)) background.src = newSrc;
    if (index !== bg) {
      if (index !== 0) hash.set('bg', index);
      else hash.delete('bg');
    }

    if (hash.has('new')) {
      newButton.click();
      return;
    }

    const id = hash.get('id');
    const ep = hash.get('ep');
    const shikimoriId = hash.get('shikimori');
    if (id && ep) {
      iframe.addEventListener('load', () => {
        if (id === items.get(iframe.dataset.key)?.top?.id) {
          iframe.contentWindow.postMessage({
            key: 'kodik_player_api',
            value: { method: 'change_episode', episode: Number.parseInt(ep, 10) },
          }, '*');
        }
      }, { once: true, passive: true });
    }
    if (id || shikimoriId) {
      const e = new CustomEvent('submit', { detail: { id, shikimoriId } });
      searchForm.dispatchEvent(e);
    }
  });
}
hash.callCallbacks();

window.hash = hash;
