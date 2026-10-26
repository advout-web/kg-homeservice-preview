/**
 * Katagiri Home Service
 * - ヘッダー：スクロールで隠れ、上に戻すと現れる
 * - スマホメニュー
 * - スクロール出現（.reveal / .reveal-stagger に is-in）
 * - FV：くもりをスクイージーが一度だけ拭き取る
 * - 水回りセットのタブ切替
 */
(function () {
	'use strict';

	var root = document.documentElement;
	var isShot = root.classList.contains('is-shot') || /[?&]shot=1/.test(location.search);
	var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (isShot) {
		root.classList.add('is-shot');
	}

	/* ---------- ヘッダー ---------- */
	var header = document.getElementById('site-header');
	var lastY = window.scrollY;
	var ticking = false;
	function onScroll() {
		var y = window.scrollY;
		if (header) {
			header.classList.toggle('is-scrolled', y > 8);
			var hide = y > 240 && y > lastY && !root.classList.contains('is-drawer-open');
			header.classList.toggle('is-hidden', hide);
		}
		lastY = y;
		ticking = false;
	}
	window.addEventListener('scroll', function () {
		if (!ticking) {
			window.requestAnimationFrame(onScroll);
			ticking = true;
		}
	}, { passive: true });
	onScroll();

	/* ---------- スマホメニュー ---------- */
	var btn = document.querySelector('.menu-btn');
	var drawer = document.getElementById('drawer');
	function setDrawer(open) {
		root.classList.toggle('is-drawer-open', open);
		document.body.style.overflow = open ? 'hidden' : '';
		if (btn) {
			btn.setAttribute('aria-expanded', open ? 'true' : 'false');
			btn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
			var label = btn.querySelector('.menu-btn__label');
			if (label) {
				label.textContent = open ? '閉じる' : 'メニュー';
			}
		}
		if (drawer) {
			drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
			if (open) {
				var first = drawer.querySelector('a');
				if (first) {
					first.focus({ preventScroll: true });
				}
			}
		}
	}
	if (btn && drawer) {
		btn.addEventListener('click', function () {
			setDrawer(!root.classList.contains('is-drawer-open'));
		});
		drawer.addEventListener('click', function (e) {
			if (e.target.closest('a')) {
				setDrawer(false);
			}
		});
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && root.classList.contains('is-drawer-open')) {
				setDrawer(false);
				btn.focus();
			}
		});
		window.addEventListener('resize', function () {
			if (window.innerWidth > 1180 && root.classList.contains('is-drawer-open')) {
				setDrawer(false);
			}
		});
	}

	/* ---------- スクロール出現 ---------- */
	var targets = document.querySelectorAll('.reveal, .reveal-stagger, .js-split');
	if (isShot || reduce || !('IntersectionObserver' in window)) {
		targets.forEach(function (el) { el.classList.add('is-in'); });
	} else {
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) {
					entry.target.classList.add('is-in');
					io.unobserve(entry.target);
				}
			});
		}, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
		targets.forEach(function (el) { io.observe(el); });
	}

	/* ---------- FV：ひと拭き ---------- */
	var fv = document.getElementById('fv');
	function wipe() {
		if (!fv) {
			return;
		}
		if (isShot || reduce) {
			fv.classList.add('is-done');
			return;
		}
		var duration = 1600;
		var delay = 450;
		var start = null;
		function ease(t) {
			return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
		}
		function step(ts) {
			if (start === null) {
				start = ts;
			}
			var p = Math.min(1, Math.max(0, (ts - start - delay) / duration));
			fv.style.setProperty('--wipe', (ease(p) * 106).toFixed(2) + '%');
			if (p < 1) {
				window.requestAnimationFrame(step);
			} else {
				fv.classList.add('is-done');
			}
		}
		window.requestAnimationFrame(step);
	}

	/* ---------- 読み込み完了 ---------- */
	function ready() {
		document.body.classList.add('is-ready');
		wipe();
	}
	if (fv) {
		var img = fv.querySelector('.fv__photo img');
		if (img && !img.complete) {
			var done = false;
			var go = function () {
				if (!done) {
					done = true;
					ready();
				}
			};
			img.addEventListener('load', go);
			img.addEventListener('error', go);
			window.setTimeout(go, 2500);
		} else {
			ready();
		}
	} else if (document.readyState === 'complete') {
		ready();
	} else {
		window.addEventListener('load', ready);
		window.setTimeout(ready, 1500);
	}

	/* ---------- 水回りセットのタブ ---------- */
	document.querySelectorAll('[data-sets]').forEach(function (box) {
		var tabs = Array.prototype.slice.call(box.querySelectorAll('[role="tab"]'));
		function select(tab, focus) {
			tabs.forEach(function (t) {
				var on = t === tab;
				t.setAttribute('aria-selected', on ? 'true' : 'false');
				t.tabIndex = on ? 0 : -1;
				var panel = document.getElementById(t.getAttribute('aria-controls'));
				if (panel) {
					panel.hidden = !on;
				}
			});
			if (focus) {
				tab.focus();
			}
		}
		tabs.forEach(function (tab, i) {
			tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
			tab.addEventListener('click', function () { select(tab, false); });
			tab.addEventListener('keydown', function (e) {
				var next = null;
				if (e.key === 'ArrowRight') { next = tabs[(i + 1) % tabs.length]; }
				if (e.key === 'ArrowLeft') { next = tabs[(i - 1 + tabs.length) % tabs.length]; }
				if (e.key === 'Home') { next = tabs[0]; }
				if (e.key === 'End') { next = tabs[tabs.length - 1]; }
				if (next) {
					e.preventDefault();
					select(next, true);
				}
			});
		});
	});
})();
