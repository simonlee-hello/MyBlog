(function () {
  const script = document.currentScript;
  let dataBaseUrl = script && script.getAttribute('data-base-url');
  let dataPagePvId = script && script.getAttribute('data-page-pv-id');
  let dataPageUvId = script && script.getAttribute('data-page-uv-id');
  let dataSitePvId = script && script.getAttribute('data-site-pv-id');
  let dataSiteUvId = script && script.getAttribute('data-site-uv-id');

  const WebViso = {};
  WebViso.version = '1.1.0';
  let BASE_API_PATH = 'https://analytics.leeissonba.com';

  WebViso.page_pv_id = 'page_pv';
  WebViso.page_uv_id = 'page_uv';
  WebViso.site_pv_id = 'site_pv';
  WebViso.site_uv_id = 'site_uv';

  if (dataBaseUrl) {
    BASE_API_PATH = dataBaseUrl.replace(/\/$/, '');
  }
  if (dataPagePvId) {
    WebViso.page_pv_id = dataPagePvId;
  }
  if (dataPageUvId) {
    WebViso.page_uv_id = dataPageUvId;
  }
  if (dataSitePvId) {
    WebViso.site_pv_id = dataSitePvId;
  }
  if (dataSiteUvId) {
    WebViso.site_uv_id = dataSiteUvId;
  }

  function getLocation(href) {
    const l = document.createElement('a');
    l.href = href;
    return l;
  }

  function fetchJson(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(function (res) {
      return res.json();
    });
  }

  /** 列表卡片：只读批量填充 data-pv-path，不增加计数 */
  WebViso.fillListPv = async function () {
    const nodes = document.querySelectorAll('[data-pv-path]');
    if (!nodes.length) {
      return;
    }
    const paths = [];
    const pathSet = {};
    nodes.forEach(function (el) {
      const p = el.getAttribute('data-pv-path');
      if (p && !pathSet[p]) {
        pathSet[p] = true;
        paths.push(p);
      }
    });
    try {
      const res = await fetchJson(BASE_API_PATH + '/api/pv', {
        hostname: window.location.hostname,
        paths: paths,
      });
      if (!res || res.ret !== 'OK') {
        console.error('WebViso.fillListPv error', res && res.message);
        return;
      }
      const counts = res.data || {};
      nodes.forEach(function (el) {
        const p = el.getAttribute('data-pv-path');
        if (p != null && counts[p] != null) {
          el.innerText = String(counts[p]);
        } else {
          el.innerText = '0';
        }
      });
    } catch (err) {
      console.log('WebViso.fillListPv fetch error', err);
    }
  };

  WebViso.init = async function () {
    const thisPage = getLocation(window.location.href);
    const pagePvEle = document.getElementById(WebViso.page_pv_id);
    const pageUvEle = document.getElementById(WebViso.page_uv_id);
    const sitePvEle = document.getElementById(WebViso.site_pv_id);
    const siteUvEle = document.getElementById(WebViso.site_uv_id);
    const queryData = {
      url: thisPage.pathname,
      hostname: thisPage.hostname,
      referrer: document.referrer,
    };
    if (pagePvEle) {
      queryData.pv = true;
    }
    if (pageUvEle) {
      queryData.uv = true;
    }
    if (sitePvEle) {
      queryData.spv = true;
    }
    if (siteUvEle) {
      queryData.suv = true;
    }
    try {
      const res = await fetchJson(BASE_API_PATH + '/api/visit', queryData);
      if (!res || res.ret !== 'OK') {
        console.error('WebViso.init error', res && res.message);
      } else {
        const resData = res.data || {};
        if (pagePvEle && resData.pv != null) {
          pagePvEle.innerText = String(resData.pv);
        }
        if (pageUvEle && resData.uv != null) {
          pageUvEle.innerText = String(resData.uv);
        }
        if (sitePvEle && resData.spv != null) {
          sitePvEle.innerText = String(resData.spv);
        }
        if (siteUvEle && resData.suv != null) {
          siteUvEle.innerText = String(resData.suv);
        }
      }
    } catch (err) {
      console.log('WebViso.init fetch error', err);
    }
    await WebViso.fillListPv();
  };

  if (typeof window !== 'undefined') {
    WebViso.init();
    window.WebViso = WebViso;
  }
})();
