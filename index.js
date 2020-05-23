(function main() {
  'use strict';

  let sortedItems = [];

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

  { // searchForm submit
    const noImgUrl = 'no-img.jpg';
    const UrlBeginning = 'https://metamedia.glitch.me/api/search?';
    const urlEnding = '3052d1g31gb8daf0a1g4cga770fcga3d80bfe1bd3e0e28b7cfd7aacebaaf4f6b';
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');

    const titlesIncludes = ({ title, titleOrig, titleOther }, str) => {
      const titles = [
        title.toLowerCase().replace(/[ ,:]/g, ''),
        titleOrig.toLowerCase().replace(/[ ,:]/g, ''),
        titleOther.toLowerCase().replace(/[ ,:]/g, ''),
      ];
      const lowerStr = str.toLowerCase().replace(/[ ,:]/g, '');
      return titles.find((t) => t.includes(lowerStr));
    };

    const getImg = (walink) => {
      if (!walink) return noImgUrl;
      const type = walink.substring(walink.lastIndexOf('/') + 1, walink.indexOf('.php'));
      const id = walink.substring(walink.lastIndexOf('id=') + 3);
      const dir = type === 'cinema'
        ? Math.ceil(id / 5000) * 5000
        : Math.ceil(id / 1000) * 1000;
      return `http://www.world-art.ru/${type}/img/${dir}/${id}/1.jpg`;
    };

    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { id } = e.detail || { id: null };
      const query = searchInput.value;
      if (!id && query === '') return;
      if (!id) window.location.hash = '';
      const startSearch = new Date().getTime();
      const list = document.getElementById('list');
      const status = document.getElementById('status');
      status.textContent = 'Поиск…';
      list.style.display = 'none';
      status.style.display = 'block';
      let queryUrl = '';
      let title = '';
      if (id) {
        queryUrl = `id=${encodeURI(id)}&`;
      } else if (query.includes('http://www.world-art.ru/cinema/cinema.php?id=')
        || query.includes('http://www.world-art.ru/animation/animation.php?id=')) {
        queryUrl = `worldart_link=${encodeURI(query)}&`;
      } else {
        queryUrl = `title=${encodeURI(query)}&`;
        title = query;
      }
      const res = await fetch(`${UrlBeginning}${queryUrl}sign=${urlEnding.replace(/g/g, 9)}`);
      const resJson = await res.json();
      const { results } = resJson;
      if (!results || results.length === 0) {
        const endSearch = new Date().getTime();
        status.textContent = `Ничего не найдено (${(endSearch - startSearch) / 1000} сек.)`;
        if (resJson.error) console.log(resJson.error);
        return;
      }
      // parse
      const items = {};
      results.forEach((el) => {
        const key = el.worldart_link || `${el.type}${el.year}${el.title_orig}`;
        if (!items[key]) {
          items[key] = {};
          items[key].id = el.id;
          items[key].title = el.title || '';
          items[key].titleOrig = el.title_orig || '';
          items[key].titleOther = el.other_title || '';
          items[key].year = el.year;
          items[key].episodes = el.episodes_count || '';
          items[key].translation = el.translation.title || '';
          items[key].img = getImg(el.worldart_link);
          items[key].link = `https:${el.link}`;
          items[key].weight = 0;
          items[key].raw = [];
          // weighing
          if (title && titlesIncludes(items[key], title)) items[key].weight += 10;
          if (items[key].img !== noImgUrl) items[key].weight += 1;
        } else {
          items[key].translation += `, ${el.translation.title}`;
        }
        items[key].raw.push(el);
      });
      // sort
      sortedItems = Object.values(items).sort((a, b) => {
        if (b.weight - a.weight) {
          return b.weight - a.weight;
        }
        if (b.year - a.year) {
          return b.year - a.year;
        }
        return a.title.localeCompare(b.title);
      });
      // build html
      let html = '';
      sortedItems.forEach((item, index) => {
        html += `<div class="item">
  <div class="left">
    <div class="poster-wrapper">
      <img class="poster" src="${item.img}" />
    </div>
    <div class="info">
      <p class="title">${item.title}</p>
      <p class="titleOrig">${item.titleOrig}</p>
      <p class="titleOther">${item.titleOther}</p>
      <p class="translation">${item.year}г. ${item.episodes}${item.episodes ? ' эп. ' : ''}Перевод: ${item.translation}</p>
    </div>
  </div>
  <div class="right">
    <button class="right-button iframe-button" data-link="${item.link}" data-id="${item.id}">▷</button>
    <button class="right-button json-button" data-index="${index}">JSON</button>
  </div>
</div>`;
      });
      list.innerHTML = html;
      const endSearch = new Date().getTime();
      status.textContent = `Найдено: ${sortedItems.length} [${results.length}] (${(endSearch - startSearch) / 1000} сек.)`;
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
          window.location.hash = target.getAttribute('data-id');
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

  { // id from url hash
    const id = window.location.hash.substr(1);
    if (id) {
      const e = new CustomEvent('submit', { detail: { id } });
      const searchForm = document.getElementById('search-form');
      searchForm.dispatchEvent(e);
    }
  }
  {
    const messageListner = (e) => {
      console.log(e.data);
    };
    window.addEventListener('message', messageListner);
  }
}());
