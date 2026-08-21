/* ============================================================
   SEASONAL FALLING LEAVES — featured.html
   ============================================================
   Three jobs:

     1. Spawn drifting leaves into the fixed #slFall overlay. Each gets a
        set of randomised CSS custom properties; all the motion itself lives
        in css/seasonal.css as keyframes, so this runs once on load and then
        does nothing per-frame — no requestAnimationFrame loop.

     2. Stop the falling leaves at the leaf pile instead of at the bottom of
        the window, so they read as landing on it rather than sliding behind
        the footer. Done by pinning the overlay's bottom edge to the pile's
        crest whenever the pile is on screen; a CSS mask dissolves each leaf
        over the last stretch so nothing visibly clips.

     3. Accumulate settled leaves on the crest while the pile is in view, so
        the pile appears to be building up as you watch it.

   ADDING A SEASON
   ---------------
   Add an entry to SEASONS keyed by the data-season value on <body>, then
   swap the class + attribute in featured.html. An unknown or missing season
   spawns nothing and leaves the page perfectly usable.
   ============================================================ */
(function () {
	'use strict';

	var SVG_NS = 'http://www.w3.org/2000/svg';

	/* ---------------------------------------------------------------- artwork
	   These match the shapes in tools/genpile.py, which draws the pile. Kept as
	   their own copy rather than <use>-ing the pile's <defs> so the falling
	   leaves keep working even if the pile markup is ever changed or removed.
	   If you restyle one, restyle both. */
	var OUTLINE = 'stroke="rgba(28,14,4,.5)" stroke-width="2.2" stroke-linejoin="round"';
	var VEIN = 'fill="none" stroke="rgba(28,14,4,.28)" stroke-width="2" stroke-linecap="round"';

	var SHAPES = {
		maple:
			'<path d="M50 6 L55 25 L69 16 L66 36 L84 32 L73 50 L90 58 L71 64 L77 80 L59 75 L55 87 L52 79 L52 99 L48 99 L48 79 L45 87 L41 75 L23 80 L29 64 L10 58 L27 50 L16 32 L34 36 L31 16 L45 25 Z" ' + OUTLINE + '/>' +
			'<path d="M50 96 L50 30 M50 44 L31 34 M50 44 L69 34 M50 58 L28 52 M50 58 L72 52" ' + VEIN + '/>',
		oak:
			'<path d="M50 5 C56 11 59 17 58 24 C65 20 73 22 75 30 C77 38 71 43 63 43 C71 47 77 53 75 61 C73 69 65 71 58 67 C59 74 55 82 52 90 L52 99 L48 99 L48 90 C45 82 41 74 42 67 C35 71 27 69 25 61 C23 53 29 47 37 43 C29 43 23 38 25 30 C27 22 35 20 42 24 C41 17 44 11 50 5 Z" ' + OUTLINE + '/>' +
			'<path d="M50 96 L50 14 M50 32 L34 26 M50 32 L66 26 M50 52 L32 46 M50 52 L68 46" ' + VEIN + '/>',
		ovate:
			'<path d="M50 3 C73 27 85 53 51 90 L51 99 L49 99 L49 90 C15 53 27 27 50 3 Z" ' + OUTLINE + '/>' +
			'<path d="M50 97 L50 8 M50 26 L36 19 M50 26 L64 19 M50 44 L33 36 M50 44 L67 36 M50 62 L37 55 M50 62 L63 55" ' + VEIN + '/>',
		aspen:
			'<path d="M50 5 C68 12 84 27 84 46 C84 65 69 82 52 89 L52 99 L48 99 L48 89 C31 82 16 65 16 46 C16 27 32 12 50 5 Z" ' + OUTLINE + '/>' +
			'<path d="M50 96 L50 12 M50 30 L34 23 M50 30 L66 23 M50 50 L30 43 M50 50 L70 43" ' + VEIN + '/>',
		birch:
			'<path d="M50 4 C62 19 72 37 70 55 C68 71 60 84 51 91 L51 99 L49 99 L49 91 C40 84 32 71 30 55 C28 37 38 19 50 4 Z" ' + OUTLINE + '/>' +
			'<path d="M50 97 L50 10 M50 28 L37 21 M50 28 L63 21 M50 46 L34 39 M50 46 L66 39" ' + VEIN + '/>',
		willow:
			'<path d="M50 3 C60 26 66 54 52 89 L52 99 L48 99 L48 89 C34 54 40 26 50 3 Z" ' + OUTLINE + '/>' +
			'<path d="M50 97 L50 8 M50 30 L41 24 M50 30 L59 24 M50 50 L40 44 M50 50 L60 44" ' + VEIN + '/>'
	};

	var SEASONS = {
		fall: {
			shapes: ['maple', 'oak', 'ovate', 'aspen', 'birch', 'willow'],
			/* Airborne leaves run lighter and warmer than the pile: they are lit
			   from all sides, and they have to read against a pale background. */
			colors: ['#B5702F', '#C4873C', '#A85A28', '#C9A052', '#9E5324',
					 '#B8452A', '#C56B30', '#A87A3C', '#8E5620'],
			/* How many leaves exist at once. This is a fixed pool sized to the
			   WINDOW, not the page: leaves are recycled through the viewport, so
			   a 2,000px page and a 20,000px page both cost the same and show the
			   same density. */
			poolSize: 17,
			poolSizeSmall: 9,
			size: [26, 52],
			sizeSmall: [18, 34],
			/* Fall speed in page px per second. Duration is derived from this and
			   the run length, so a leaf drifts at a consistent rate whatever the
			   window height. */
			speed: [46, 84],
			sway: [20, 78],
			swayDur: [3, 7],
			spinDur: [5, 13],

			/* Leaves that come to rest on the crest */
			settleColors: ['#C08A45', '#B5702F', '#C9A052', '#A85A28', '#BE7B38',
						   '#B8452A', '#CBA96E', '#A66A2C'],
			settleScale: [0.44, 0.68],
			settleMax: 20,
			settleEveryMs: 1100
		}
	};

	var SMALL_SCREEN = 640;

	/* Pile geometry, in the pile SVG's own viewBox units. Both values are
	   dictated by tools/genpile.py — if you change W/H or profile() there,
	   regenerate these. PROFILE samples the crest every PROFILE_STEP units. */
	var PILE_VB_H = 230;
	var PROFILE_STEP = 60;
	var PROFILE = [128, 121, 119, 119, 119, 118, 115, 114, 115, 118, 123, 126,
				   126, 123, 117, 112, 108, 106, 103, 99, 93, 88, 86, 89, 97,
				   109, 119, 126, 127, 124, 120, 118, 120, 125, 131, 135, 138];
	/* 2160 — matches W in tools/genpile.py */
	var PILE_VB_W = (PROFILE.length - 1) * PROFILE_STEP;
	/* Height in the viewBox at which falling leaves should be fully dissolved —
	   the middle of the crest band (which spans roughly 86..138). */
	var CREST_Y = 112;

	function rand(min, max) { return Math.random() * (max - min) + min; }
	function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

	/* Crest height at x, linearly interpolated between samples */
	function crestAt(x) {
		var t = Math.max(0, Math.min(PILE_VB_W, x)) / PROFILE_STEP;
		var i = Math.min(PROFILE.length - 2, Math.floor(t));
		return PROFILE[i] + (PROFILE[i + 1] - PROFILE[i]) * (t - i);
	}

	function makeLeafSvg(cfg, shapeKey, fill) {
		var svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('viewBox', '0 0 100 100');
		svg.setAttribute('fill', fill);
		svg.setAttribute('focusable', 'false');
		/* SHAPES holds hard-coded artwork constants defined at the top of this
		   file — no user, URL or network input ever reaches here. */
		svg.innerHTML = SHAPES[shapeKey];
		return svg;
	}

	function buildLeaf(cfg, small, run, index, total) {
		var sizeRange = small ? cfg.sizeSmall : cfg.size;
		var size = rand(sizeRange[0], sizeRange[1]);
		/* Each leaf's run is a bit longer than the window, so it always has room
		   to enter, cross and leave. Duration comes from a target speed rather
		   than being fixed, so leaves drift at the same rate on any screen. */
		var dist = run + size;
		var dur = dist / rand(cfg.speed[0], cfg.speed[1]);

		var leaf = document.createElement('div');
		leaf.className = 'sl-leaf';
		leaf.style.setProperty('--sl-x', rand(-2, 98).toFixed(2) + '%');
		leaf.style.setProperty('--sl-size', size.toFixed(1) + 'px');
		leaf.style.setProperty('--sl-travel', dist.toFixed(1) + 'px');
		leaf.style.setProperty('--sl-dur', dur.toFixed(2) + 's');
		/* A negative delay starts each leaf partway down its path. This is what
		   spreads the leaves over the length of the page instead of releasing
		   them all from the top at once.

		   The phase is stratified — leaf i takes slot i of `total`, jittered
		   within that slot — rather than picked at random. Pure random phases
		   clump, which leaves a bald stretch of page with no leaves in it. Since
		   the fraction is of each leaf's OWN duration, they stay evenly spread
		   along the path even though they fall at different speeds. */
		var phase = (index + Math.random()) / total;
		leaf.style.setProperty('--sl-delay', (-phase * dur).toFixed(2) + 's');

		var sway = document.createElement('div');
		sway.className = 'sl-leaf__sway';
		sway.style.setProperty('--sl-sway', rand(cfg.sway[0], cfg.sway[1]).toFixed(1) + 'px');
		sway.style.setProperty('--sl-sway-dur', rand(cfg.swayDur[0], cfg.swayDur[1]).toFixed(2) + 's');

		var svg = makeLeafSvg(cfg, pick(cfg.shapes), pick(cfg.colors));
		svg.setAttribute('class', 'sl-leaf__spin');
		svg.style.setProperty('--sl-opacity', rand(0.62, 0.95).toFixed(2));
		svg.style.setProperty('--sl-spin-dur', rand(cfg.spinDur[0], cfg.spinDur[1]).toFixed(2) + 's');
		/* Randomising the rotation axis makes each leaf tumble on its own plane
		   rather than every leaf spinning flat the same way. */
		svg.style.setProperty('--sl-rx', rand(-1, 1).toFixed(2));
		svg.style.setProperty('--sl-ry', rand(-1, 1).toFixed(2));
		if (Math.random() < 0.5) svg.style.animationDirection = 'reverse';

		sway.appendChild(svg);
		leaf.appendChild(sway);
		return leaf;
	}

	/* Distance from the top of the DOCUMENT down to the pile's crest. This is
	   how tall the falling-leaf overlay needs to be: leaves drift the length of
	   the page and dissolve into the pile at the end of it. */
	function crestDocY(pile) {
		var r = pile.getBoundingClientRect();
		/* The pile SVG uses preserveAspectRatio="xMidYMax slice", so it is
		   scaled to cover and anchored to its bottom edge. Undo exactly that to
		   find where CREST_Y sits. */
		var scale = Math.max(r.width / PILE_VB_W, r.height / PILE_VB_H);
		return r.bottom + window.scrollY - (PILE_VB_H - CREST_Y) * scale;
	}

	/* ------------------------------------------------------------------------
	   RECYCLING

	   Leaves are anchored to the page, so keeping a constant number of them on
	   screen would otherwise need a leaf count proportional to page length —
	   this page is 25 screens tall, which would mean hundreds of animated
	   elements. Instead a small fixed pool is reused: when a leaf finishes its
	   run it is moved back up near the current viewport to run again.

	   The rule that keeps this honest is that a leaf is ONLY ever moved while it
	   cannot be seen:

	     * on 'animationiteration', which fires at the loop boundary, where
	       slLeafFade has opacity pinned to 0
	     * when it is well outside the viewport, where it is off-screen anyway

	   So a leaf you can actually see never moves relative to the page — you
	   scroll past it — while off-screen leaves quietly return to the top.
	   ------------------------------------------------------------------------ */
	function placeLeaf(leaf, run) {
		/* Start somewhere in the band just above the viewport, so leaves enter
		   from off-screen at staggered moments rather than all at once. */
		var top = window.scrollY - rand(0.06, 0.42) * run;
		leaf.style.top = Math.round(top) + 'px';
		leaf.style.setProperty('--sl-x', rand(-2, 98).toFixed(2) + '%');
	}

	/* getRun is a function, not a number: the run length changes when the window
	   is resized and the pool is rebuilt, and a captured value would go stale. */
	function bindRecycling(container, getRun) {
		/* One delegated listener rather than one per leaf. Only the fall
		   animation counts — slLeafFade fires its own iteration event too. */
		container.addEventListener('animationiteration', function (e) {
			if (e.animationName !== 'slFall') return;
			var leaf = e.target;
			if (leaf && leaf.classList && leaf.classList.contains('sl-leaf')) {
				placeLeaf(leaf, getRun());
			}
		});

		/* After a fast scroll a leaf can be left far behind, still mid-run and
		   invisible off-screen. Waiting for its loop would leave the viewport
		   thin for a while, so recover those immediately. Restarting the
		   animation keeps it from fading in halfway through its run. */
		var queued = false;
		function sweep() {
			queued = false;
			var run = getRun();
			var top = window.scrollY;
			var bottom = top + window.innerHeight;
			var leaves = container.children;
			for (var i = 0; i < leaves.length; i++) {
				var l = leaves[i];
				var y = l.offsetTop;
				if (y > bottom + run || y < top - 2 * run) {
					placeLeaf(l, run);
					/* Clear the negative start delay before restarting. That delay
					   exists to stagger the pool on first build; if it survived a
					   restart the leaf would resume partway down its run at full
					   opacity and visibly pop into the middle of the screen.
					   Zeroing it makes the restart begin at phase 0, where
					   slLeafFade holds opacity at 0. Later loops are unaffected —
					   animation-delay only applies to the first iteration. */
					l.style.setProperty('--sl-delay', '0s');
					l.style.animation = 'none';
					void l.offsetWidth;          /* force reflow so the restart takes */
					l.style.animation = '';
				}
			}
		}
		window.addEventListener('scroll', function () {
			if (queued) return;
			queued = true;
			window.requestAnimationFrame(sweep);
		}, { passive: true });
	}

	/* ------------------------------------------------------------------------
	   Settled leaves accumulating on the crest while the pile is in view — the
	   "piling up" half of the illusion.

	   Driven off an rAF-throttled scroll handler rather than an
	   IntersectionObserver: one source of truth for "is the pile on screen",
	   and no silent do-nothing if the observer never fires.

	   Note this no longer repositions the overlay. Because the overlay is
	   anchored to the document, scrolling does not move it relative to the
	   page and there is nothing to correct per-frame.
	   ------------------------------------------------------------------------ */
	function bindPile(cfg, container, pile, settleGroup) {
		var queued = false;
		var placed = 0;
		var timer = null;

		function addSettled() {
			if (placed >= cfg.settleMax) { stopSettling(); return; }
			placed++;

			var x = rand(20, PILE_VB_W - 20);
			var y = crestAt(x) - rand(1, 13);

			var g = document.createElementNS(SVG_NS, 'g');
			g.setAttribute('class', 'sl-settled');

			var u = document.createElementNS(SVG_NS, 'use');
			u.setAttribute('href', '#slLeaf-' + pick(cfg.shapes));
			u.setAttribute('fill', pick(cfg.settleColors));
			u.setAttribute('transform',
				'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') ' +
				'rotate(' + rand(0, 360).toFixed(1) + ') ' +
				'scale(' + rand(cfg.settleScale[0], cfg.settleScale[1]).toFixed(3) + ') ' +
				'translate(-50 -50)');

			g.appendChild(u);
			settleGroup.appendChild(g);
		}

		function startSettling() {
			if (timer || !settleGroup || placed >= cfg.settleMax) return;
			timer = window.setInterval(addSettled, cfg.settleEveryMs);
		}

		function stopSettling() {
			if (!timer) return;
			window.clearInterval(timer);
			timer = null;
		}

		function apply() {
			queued = false;
			var r = pile.getBoundingClientRect();
			if (!r.height) return;

			var onScreen = r.top < window.innerHeight && r.bottom > 0;
			if (onScreen && !document.hidden) { startSettling(); } else { stopSettling(); }
		}

		function schedule() {
			if (queued) return;
			queued = true;
			window.requestAnimationFrame(apply);
		}

		apply();
		window.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule);
		/* Late-loading images shift the page height under us */
		window.addEventListener('load', apply);
		/* Don't quietly pile up leaves in a tab nobody is looking at */
		document.addEventListener('visibilitychange', apply);
	}

	function init() {
		var container = document.getElementById('slFall');
		if (!container) return;

		/* Honour the OS "reduce motion" setting. css/seasonal.css hides the
		   container too; bailing here means we also skip building the DOM. */
		var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
		if (reduce && reduce.matches) return;

		var cfg = SEASONS[document.body.getAttribute('data-season')];
		if (!cfg) return;

		var pile = document.getElementById('slPile');
		if (pile) container.classList.add('sl-fall--lands');

		var builtRun = -1;

		/* The overlay is sized to the page so it can end at the pile's crest;
		   the leaves inside it are sized to the WINDOW and recycled. Height is
		   therefore cheap to update, while rebuilding the pool is not, so the
		   two are kept separate. */
		function syncHeight() {
			var height = pile ? crestDocY(pile) : document.documentElement.scrollHeight;
			container.style.height = Math.round(height) + 'px';
		}

		function buildPool() {
			var small = window.innerWidth <= SMALL_SCREEN;
			var run = Math.round(window.innerHeight * 1.7);

			/* Ignore the small height wobbles a mobile URL bar produces —
			   rebuilding on those would visibly restart every leaf. */
			if (Math.abs(run - builtRun) < 120) return;
			builtRun = run;

			var count = small ? cfg.poolSizeSmall : cfg.poolSize;
			var frag = document.createDocumentFragment();
			for (var i = 0; i < count; i++) {
				var leaf = buildLeaf(cfg, small, run, i, count);
				placeLeaf(leaf, run);
				frag.appendChild(leaf);
			}

			container.textContent = '';
			container.appendChild(frag);
		}

		syncHeight();
		buildPool();
		bindRecycling(container, function () { return builtRun; });

		/* Late-loading images change the page height under us */
		window.addEventListener('load', syncHeight);

		var resizeTimer = null;
		window.addEventListener('resize', function () {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(function () {
				syncHeight();
				buildPool();
			}, 200);
		});

		/* Stop animating while the tab is in the background */
		document.addEventListener('visibilitychange', function () {
			container.classList.toggle('sl-paused', document.hidden);
		});

		if (pile) bindPile(cfg, container, pile, document.getElementById('slSettle'));
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
