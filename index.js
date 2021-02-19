(function main() {
  'use strict';

  let sortedItems = [];

  const hashGet = () => {
    if (!window.location.hash) return {};
    const entries = window.location.hash.substring(1).split('&');
    const id = entries.find((s) => s.includes('movie-') || s.includes('serial-'));
    const shikimoriEntry = entries.find((s) => s.includes('shikimori-'));
    return { id, shikimoriId: shikimoriEntry?.substring(10) };
  };

  const hashSet = ({ id, shikimoriId }) => {
    if (!id && !shikimoriId) return;
    let hash = '';
    if (shikimoriId) hash = `shikimori-${shikimoriId}`;
    if (id) hash += hash ? `&${id}` : id;
    window.location.hash = hash;
  };

  const parse = (results, { queryTitle, presort }) => {
    const noImgUrl = 'no-img.jpg';
    const items = {};
    const getImg = (shikimoriId) => {
      if (!shikimoriId) return noImgUrl;
      const subs = ['nyaa', 'kawai', 'moe', 'desu', 'dere'];
      const sub = subs[shikimoriId % subs.length];
      const timestamp = 1604598358 + (+shikimoriId);
      return `https://${sub}.shikimori.one/system/animes/original/${shikimoriId}.jpg?${timestamp}`;
    };
    const titlesIncludes = ({ title, titleOrig, titleOther }, str) => {
      const titles = [
        title.toLowerCase().replace(/[ ,:]/g, ''),
        titleOrig.toLowerCase().replace(/[ ,:]/g, ''),
        titleOther.toLowerCase().replace(/[ ,:]/g, ''),
      ];
      const lowerStr = str.toLowerCase().replace(/[ ,:]/g, '');
      return titles.find((t) => t.includes(lowerStr));
    };
    results.forEach((el) => {
      const key = el.worldart_link || el.shikimori_id || `${el.type}${el.year}${el.title_orig}`;
      if (!items[key]) {
        items[key] = {};
        items[key].id = el.id;
        items[key].shikimoriId = el.shikimori_id || '';
        items[key].title = el.title || '';
        items[key].titleOrig = el.title_orig || '';
        items[key].titleOther = el.other_title || '';
        items[key].year = el.year;
        items[key].episodes = el.last_episode || '';
        items[key].translation = el.translation.title;
        if (items[key].episodes) items[key].translation += `[${items[key].episodes}]`;
        items[key].img = getImg(el.shikimori_id);
        items[key].link = `https:${el.link}`;
        items[key].updatedAt = el.updated_at;
        // weighing
        if (queryTitle) {
          items[key].weight = 0;
          if (titlesIncludes(items[key], queryTitle)) items[key].weight += 10;
          if (items[key].img !== noImgUrl) items[key].weight += 1;
        }
        items[key].tr = {};
        items[key].raw = [];
      } else if (presort && items[key].episodes < el.last_episode) {
        items[key].id = el.id;
        items[key].link = `https:${el.link}`;
        items[key].episodes = el.last_episode;
        let temp = el.translation.title;
        if (items[key].episodes) temp += `[${items[key].episodes}]`;
        items[key].translation = `${temp}, ${items[key].translation}`;
        items[key].updatedAt = el.updated_at;
      } else {
        items[key].translation += `, ${el.translation.title}`;
        if (el.last_episode) items[key].translation += `[${el.last_episode}]`;
      }
      items[key].tr[el.translation.id] = el.id;
      items[key].raw.push(el);
    });
    return items;
  };

  const buildHTML = () => {
    let html = '';
    sortedItems.forEach((item, index) => {
      html += `<div class="item">
<div class="left">
<div class="poster-wrapper">
  <img class="poster" src="${item.img}" alt="" />
</div>
<div class="info">
  <p class="title">${item.title}</p>
  <p class="titleOrig">${item.titleOrig}</p>
  <p class="titleOther">${item.titleOther}</p>
  <p class="translation">${item.year}г. ${item.episodes}${item.episodes ? ' эп. ' : ''}${item.translation}</p>
</div>
</div>
<div class="right">
<button class="right-button iframe-button" data-link="${item.link}" data-id="${item.id}" data-shikimori_id="${item.shikimoriId}">▷</button>
<button class="right-button json-button" data-index="${index}">JSON</button>
</div>
</div>`;
    });
    return html;
  };

  const sendQuery = async (query) => {
    const status = document.getElementById('status');
    const UrlBeginning = 'https://metamedia.glitch.me/api/';
    const urlEnding = '3052d1g31gb8daf0a1g4cga770fcga3d80bfe1bd3e0e28b7cfd7aacebaaf4f6b';
    const searchStartTime = new Date().getTime();
    status.textContent = 'Поиск…';
    status.style.display = 'block';
    const res = await fetch(`${UrlBeginning}${query}&sign=${urlEnding.replace(/g/g, 9)}`);
    const resJson = await res.json();
    const { results } = resJson;
    const searchTime = new Date().getTime() - searchStartTime;
    if (!results || results.length === 0) {
      status.textContent = `Ничего не найдено (${searchTime / 1000} сек.)`;
      if (resJson.error) console.log(resJson.error);
      return [[], searchTime];
    }
    return [results, searchTime];
  };

  { // backgroundButton click
    const background = document.getElementById('background');
    const backgroundButton = document.getElementById('background-button');
    const backgroundMax = 2;
    backgroundButton.addEventListener('click', () => {
      let backgroundIndex = parseInt(localStorage.getItem('backgroundIndex'), 10) || 0;
      backgroundIndex = backgroundIndex < backgroundMax ? backgroundIndex + 1 : 0;
      background.src = `wallpaper/${backgroundIndex}.mp4`;
      localStorage.setItem('backgroundIndex', backgroundIndex);
    }, { passive: true });
  }
  { // newButton click
    const newButton = document.getElementById('new-button');
    newButton.addEventListener('click', async (e) => {
      let queryParam = 'types=anime,anime-serial&limit=100';
      if (e.detail && e.detail.hash) {
        queryParam += window.location.hash.substring(4);
      } else {
        window.location.hash = 'new';
      }
      const list = document.getElementById('list');
      const status = document.getElementById('status');
      list.style.display = 'none';
      const [results, searchTime] = await sendQuery(`list?${queryParam}`);
      if (results.length === 0) return;
      // reverse make oldest on top, then glue younger to it
      const items = parse(results.reverse(), { presort: true });
      // sort
      sortedItems = Object.values(items).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      status.textContent = `Найдено: ${sortedItems.length} [${results.length}] (${(searchTime) / 1000} сек.)`;
      list.innerHTML = buildHTML();
      list.style.display = 'block';
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
      if (!someId) window.location.hash = '';
      const list = document.getElementById('list');
      const status = document.getElementById('status');
      list.style.display = 'none';
      let queryParam = '';
      let queryTitle = '';
      if (shikimoriId) {
        queryParam = `shikimori_id=${encodeURI(shikimoriId)}`;
      } else if (id) {
        queryParam = `id=${encodeURI(id)}`;
      } else if (query.includes('http://www.world-art.ru/cinema/cinema.php?id=')
        || query.includes('http://www.world-art.ru/animation/animation.php?id=')) {
        queryParam = `worldart_link=${encodeURI(query)}`;
      } else {
        queryParam = `title=${encodeURI(query)}`;
        queryTitle = query;
      }
      const [results, searchTime] = await sendQuery(`search?${queryParam}`);
      if (results.length === 0) return;
      // unshift entry with given id
      if (id && results.length > 1) {
        const index = results.findIndex((r) => r.id === id);
        results.unshift(results.splice(index, 1)[0]);
      }
      const items = parse(results, { queryTitle, presort: !id });
      if (queryTitle) {
        sortedItems = Object.values(items).sort((a, b) => {
          if (b.weight - a.weight) {
            return b.weight - a.weight;
          }
          if (b.year - a.year) {
            return b.year - a.year;
          }
          return a.title.localeCompare(b.title);
        });
      } else {
        sortedItems = Object.values(items);
      }
      status.textContent = `Найдено: ${sortedItems.length} [${results.length}] (${(searchTime) / 1000} сек.)`;
      list.innerHTML = buildHTML();
      list.style.display = 'block';
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
      if (className.includes('iframe-button')) {
        const link = target.getAttribute('data-link');
        if (iframe.src !== link) {
          iframe.src = link;
          const id = target.getAttribute('data-id');
          const shikimoriId = target.getAttribute('data-shikimori_id');
          hashSet({ id, shikimoriId });
        }
        iframeOverlay.style.display = 'block';
      } else if (className.includes('json-button') && sortedItems.length) {
        const index = target.getAttribute('data-index');
        json.textContent = JSON.stringify(sortedItems[index], null, '  ');
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

  // new hash
  if (window.location.hash.includes('#new')) {
    const e = new CustomEvent('click', { detail: { hash: true } });
    document.getElementById('new-button').dispatchEvent(e);
  }

  { // ids from url hash
    const { id, shikimoriId } = hashGet();
    if (id || shikimoriId) {
      const e = new CustomEvent('submit', { detail: { id, shikimoriId } });
      document.getElementById('search-form').dispatchEvent(e);
    }
  }
  // update hash by message from iframe
  window.addEventListener('message', ({ data }) => {
    if (data?.key === 'kodik_player_current_episode') {
      const { id } = hashGet();
      const item = sortedItems.find((it) => Object.values(it.tr).includes(id));
      if (item) {
        const newId = item.tr[data.value.translation.id];
        if (newId) {
          hashSet({ id: newId, shikimoriId: item.shikimoriId });
        }
      }
    }
  });
}());
