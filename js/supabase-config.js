/* Which Supabase project a page talks to, picked by the address it is served from.
   Only the real domain uses the live project. Everything else (the GitHub Pages
   test site, localhost, a file opened from disk) uses the test project, so a file
   copied between the test and live sites can never point at the wrong database.
   renegade-wellness-admin-source/src/data/config.js makes the same choice for admin.html. */
(function () {
	'use strict';

	var PROJECTS = {
		live: { ref: 'laanxujxiioesvsyccwb', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhYW54dWp4aWlvZXN2c3ljY3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MDk4NTYsImV4cCI6MjA4NTk4NTg1Nn0.e2Ymm9nGlgGd73buvCK7bPoWXPtzJvoGY3nIQtpjy7M' },
		test: { ref: 'vjpdsefikyabxvozhbkw', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqcGRzZWZpa3lhYnh2b3poYmt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzIzNTUsImV4cCI6MjEwNjM0ODM1NX0.4I9yL9p59WW96EJfBXJJWDvMODlBod2GdpeRfI9MuCM' }
	};
	var LIVE_HOSTS = ['renegadewellnesscenter.com', 'www.renegadewellnesscenter.com'];

	var env = LIVE_HOSTS.indexOf(location.hostname) !== -1 ? 'live' : 'test';
	var p = PROJECTS[env];
	window.RWC_SUPABASE = {
		env: env,
		url: 'https://' + p.ref + '.supabase.co',
		key: p.key,
		storageKey: 'sb-' + p.ref + '-auth-token'
	};
})();
