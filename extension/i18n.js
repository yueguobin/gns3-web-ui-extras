// i18n helper — apply i18n messages to HTML elements
(function () {
  const _ = browser.i18n.getMessage.bind(browser.i18n);

  // Replace localised text in the current page
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr'); // e.g. "placeholder"
    const useHtml = el.hasAttribute('data-i18n-html');

    let msg;
    try {
      msg = _(key);
    } catch (_e) {
      msg = key;
    }
    if (!msg) return;

    if (attr) {
      el.setAttribute(attr, msg);
    } else if (useHtml) {
      el.innerHTML = msg;
    } else {
      el.textContent = msg;
    }
  });
})();
