(function () {
  const delay = 700;
  const buttons = Array.from(document.querySelectorAll('span')).filter(
    el => el.textContent.trim() === 'Continue'
  );

  const links = buttons.map(btn => {
    const parent = btn.closest('a');
    return parent ? parent.href : null;
  }).filter(Boolean);

  const uniqueLinks = [...new Set(links)];
  let index = 0;

  function openNextTab() {
    if (index >= uniqueLinks.length) {
      console.log('✅ All draft tabs opened.');
      return;
    }
    window.open(uniqueLinks[index], '_blank');
    index++;
    setTimeout(openNextTab, delay);
  }

  if (uniqueLinks.length === 0) {
    alert('No draft Continue links found on this page. Make sure Marketplace selling/drafts page is open.');
    return;
  }

  openNextTab();
})();