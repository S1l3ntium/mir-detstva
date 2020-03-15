(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() : typeof define === 'function' && define.amd ? define(factory) : (global.page = factory());
}(this, (function () {
	'use strict';
	var isarray = Array.isArray || function (arr) {
		return Object.prototype.toString.call(arr) == '[object Array]';
	};
	var pathToRegexp_1 = pathToRegexp;
	var parse_1 = parse;
	var compile_1 = compile;
	var tokensToFunction_1 = tokensToFunction;
	var tokensToRegExp_1 = tokensToRegExp;
	var PATH_REGEXP = new RegExp(['(\\\\.)', '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^()])+)\\))?|\\(((?:\\\\.|[^()])+)\\))([+*?])?|(\\*))'].join('|'), 'g');

	function parse(str) {
		var tokens = [];
		var key = 0;
		var index = 0;
		var path = '';
		var res;
		while ((res = PATH_REGEXP.exec(str)) != null) {
			var m = res[0];
			var escaped = res[1];
			var offset = res.index;
			path += str.slice(index, offset);
			index = offset + m.length;
			if (escaped) {
				path += escaped[1];
				continue
			}
			if (path) {
				tokens.push(path);
				path = '';
			}
			var prefix = res[2];
			var name = res[3];
			var capture = res[4];
			var group = res[5];
			var suffix = res[6];
			var asterisk = res[7];
			var repeat = suffix === '+' || suffix === '*';
			var optional = suffix === '?' || suffix === '*';
			var delimiter = prefix || '/';
			var pattern = capture || group || (asterisk ? '.*' : '[^' + delimiter + ']+?');
			tokens.push({
				name: name || key++,
				prefix: prefix || '',
				delimiter: delimiter,
				optional: optional,
				repeat: repeat,
				pattern: escapeGroup(pattern)
			});
		}
		if (index < str.length) {
			path += str.substr(index);
		}
		if (path) {
			tokens.push(path);
		}
		return tokens
	}

	function compile(str) {
		return tokensToFunction(parse(str))
	}

	function tokensToFunction(tokens) {
		var matches = new Array(tokens.length);
		for (var i = 0; i < tokens.length; i++) {
			if (typeof tokens[i] === 'object') {
				matches[i] = new RegExp('^' + tokens[i].pattern + '$');
			}
		}
		return function (obj) {
			var path = '';
			var data = obj || {};
			for (var i = 0; i < tokens.length; i++) {
				var token = tokens[i];
				if (typeof token === 'string') {
					path += token;
					continue
				}
				var value = data[token.name];
				var segment;
				if (value == null) {
					if (token.optional) {
						continue
					} else {
						throw new TypeError('Expected "' + token.name + '" to be defined')
					}
				}
				if (isarray(value)) {
					if (!token.repeat) {
						throw new TypeError('Expected "' + token.name + '" to not repeat, but received "' + value + '"')
					}
					if (value.length === 0) {
						if (token.optional) {
							continue
						} else {
							throw new TypeError('Expected "' + token.name + '" to not be empty')
						}
					}
					for (var j = 0; j < value.length; j++) {
						segment = encodeURIComponent(value[j]);
						if (!matches[i].test(segment)) {
							throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
						}
						path += (j === 0 ? token.prefix : token.delimiter) + segment;
					}
					continue
				}
				segment = encodeURIComponent(value);
				if (!matches[i].test(segment)) {
					throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
				}
				path += token.prefix + segment;
			}
			return path
		}
	}

	function escapeString(str) {
		return str.replace(/([.+*?=^!:${}()[\]|\/])/g, '\\$1')
	}

	function escapeGroup(group) {
		return group.replace(/([=!:$\/()])/g, '\\$1')
	}

	function attachKeys(re, keys) {
		re.keys = keys;
		return re
	}

	function flags(options) {
		return options.sensitive ? '' : 'i'
	}

	function regexpToRegexp(path, keys) {
		var groups = path.source.match(/\((?!\?)/g);
		if (groups) {
			for (var i = 0; i < groups.length; i++) {
				keys.push({
					name: i,
					prefix: null,
					delimiter: null,
					optional: false,
					repeat: false,
					pattern: null
				});
			}
		}
		return attachKeys(path, keys)
	}

	function arrayToRegexp(path, keys, options) {
		var parts = [];
		for (var i = 0; i < path.length; i++) {
			parts.push(pathToRegexp(path[i], keys, options).source);
		}
		var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options));
		return attachKeys(regexp, keys)
	}

	function stringToRegexp(path, keys, options) {
		var tokens = parse(path);
		var re = tokensToRegExp(tokens, options);
		for (var i = 0; i < tokens.length; i++) {
			if (typeof tokens[i] !== 'string') {
				keys.push(tokens[i]);
			}
		}
		return attachKeys(re, keys)
	}

	function tokensToRegExp(tokens, options) {
		options = options || {};
		var strict = options.strict;
		var end = options.end !== false;
		var route = '';
		var lastToken = tokens[tokens.length - 1];
		var endsWithSlash = typeof lastToken === 'string' && /\/$/.test(lastToken);
		for (var i = 0; i < tokens.length; i++) {
			var token = tokens[i];
			if (typeof token === 'string') {
				route += escapeString(token);
			} else {
				var prefix = escapeString(token.prefix);
				var capture = token.pattern;
				if (token.repeat) {
					capture += '(?:' + prefix + capture + ')*';
				}
				if (token.optional) {
					if (prefix) {
						capture = '(?:' + prefix + '(' + capture + '))?';
					} else {
						capture = '(' + capture + ')?';
					}
				} else {
					capture = prefix + '(' + capture + ')';
				}
				route += capture;
			}
		}
		if (!strict) {
			route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?';
		}
		if (end) {
			route += '$';
		} else {
			route += strict && endsWithSlash ? '' : '(?=\\/|$)';
		}
		return new RegExp('^' + route, flags(options))
	}

	function pathToRegexp(path, keys, options) {
		keys = keys || [];
		if (!isarray(keys)) {
			options = keys;
			keys = [];
		} else if (!options) {
			options = {};
		}
		if (path instanceof RegExp) {
			return regexpToRegexp(path, keys, options)
		}
		if (isarray(path)) {
			return arrayToRegexp(path, keys, options)
		}
		return stringToRegexp(path, keys, options)
	}
	pathToRegexp_1.parse = parse_1;
	pathToRegexp_1.compile = compile_1;
	pathToRegexp_1.tokensToFunction = tokensToFunction_1;
	pathToRegexp_1.tokensToRegExp = tokensToRegExp_1;
	var page_js = page;
	page.default = page;
	page.Context = Context;
	page.Route = Route;
	page.sameOrigin = sameOrigin;
	var hasDocument = ('undefined' !== typeof document);
	var hasWindow = ('undefined' !== typeof window);
	var hasHistory = ('undefined' !== typeof history);
	var hasProcess = typeof process !== 'undefined';
	var clickEvent = hasDocument && document.ontouchstart ? 'touchstart' : 'click';
	var isLocation = hasWindow && !!(window.history.location || window.location);
	var dispatch = true;
	var decodeURLComponents = true;
	var base = '';
	var strict = false;
	var running;
	var hashbang = false;
	var prevContext;
	var pageWindow;

	function page(path, fn) {
		if ('function' === typeof path) {
			return page('*', path);
		}
		if ('function' === typeof fn) {
			var route = new Route((path));
			for (var i = 1; i < arguments.length; ++i) {
				page.callbacks.push(route.middleware(arguments[i]));
			}
		} else if ('string' === typeof path) {
			page['string' === typeof fn ? 'redirect' : 'show'](path, fn);
		} else {
			page.start(path);
		}
	}
	page.callbacks = [];
	page.exits = [];
	page.current = '';
	page.len = 0;
	page.base = function (path) {
		if (0 === arguments.length) return base;
		base = path;
	};
	page.strict = function (enable) {
		if (0 === arguments.length) return strict;
		strict = enable;
	};
	page.start = function (options) {
		options = options || {};
		if (running) return;
		running = true;
		pageWindow = options.window || (hasWindow && window);
		if (false === options.dispatch) dispatch = false;
		if (false === options.decodeURLComponents) decodeURLComponents = false;
		if (false !== options.popstate && hasWindow) pageWindow.addEventListener('popstate', onpopstate, false);
		if (false !== options.click && hasDocument) {
			pageWindow.document.addEventListener(clickEvent, onclick, false);
		}
		hashbang = !!options.hashbang;
		if (hashbang && hasWindow && !hasHistory) {
			pageWindow.addEventListener('hashchange', onpopstate, false);
		}
		if (!dispatch) return;
		var url;
		if (isLocation) {
			var loc = pageWindow.location;
			if (hashbang && ~loc.hash.indexOf('#!')) {
				url = loc.hash.substr(2) + loc.search;
			} else if (hashbang) {
				url = loc.search + loc.hash;
			} else {
				url = loc.pathname + loc.search + loc.hash;
			}
		}
		page.replace(url, null, true, dispatch);
	};
	page.stop = function () {
		if (!running) return;
		page.current = '';
		page.len = 0;
		running = false;
		hasDocument && pageWindow.document.removeEventListener(clickEvent, onclick, false);
		hasWindow && pageWindow.removeEventListener('popstate', onpopstate, false);
		hasWindow && pageWindow.removeEventListener('hashchange', onpopstate, false);
	};
	page.show = function (path, state, dispatch, push) {
		var ctx = new Context(path, state),
			prev = prevContext;
		prevContext = ctx;
		page.current = ctx.path;
		if (false !== dispatch) page.dispatch(ctx, prev);
		if (false !== ctx.handled && false !== push) ctx.pushState();
		return ctx;
	};
	page.back = function (path, state) {
		if (page.len > 0) {
			hasHistory && pageWindow.history.back();
			page.len--;
		} else if (path) {
			setTimeout(function () {
				page.show(path, state);
			});
		} else {
			setTimeout(function () {
				page.show(getBase(), state);
			});
		}
	};
	page.redirect = function (from, to) {
		if ('string' === typeof from && 'string' === typeof to) {
			page(from, function (e) {
				setTimeout(function () {
					page.replace((to));
				}, 0);
			});
		}
		if ('string' === typeof from && 'undefined' === typeof to) {
			setTimeout(function () {
				page.replace(from);
			}, 0);
		}
	};
	page.replace = function (path, state, init, dispatch) {
		var ctx = new Context(path, state),
			prev = prevContext;
		prevContext = ctx;
		page.current = ctx.path;
		ctx.init = init;
		ctx.save();
		if (false !== dispatch) page.dispatch(ctx, prev);
		return ctx;
	};
	page.dispatch = function (ctx, prev) {
		var i = 0,
			j = 0;

		function nextExit() {
			var fn = page.exits[j++];
			if (!fn) return nextEnter();
			fn(prev, nextExit);
		}

		function nextEnter() {
			var fn = page.callbacks[i++];
			if (ctx.path !== page.current) {
				ctx.handled = false;
				return;
			}
			if (!fn) return unhandled(ctx);
			fn(ctx, nextEnter);
		}
		if (prev) {
			nextExit();
		} else {
			nextEnter();
		}
	};

	function unhandled(ctx) {
		if (ctx.handled) return;
		var current;
		if (hashbang) {
			current = isLocation && getBase() + pageWindow.location.hash.replace('#!', '');
		} else {
			current = isLocation && pageWindow.location.pathname + pageWindow.location.search;
		}
		if (current === ctx.canonicalPath) return;
		page.stop();
		ctx.handled = false;
		isLocation && (pageWindow.location.href = ctx.canonicalPath);
	}
	page.exit = function (path, fn) {
		if (typeof path === 'function') {
			return page.exit('*', path);
		}
		var route = new Route(path);
		for (var i = 1; i < arguments.length; ++i) {
			page.exits.push(route.middleware(arguments[i]));
		}
	};

	function decodeURLEncodedURIComponent(val) {
		if (typeof val !== 'string') {
			return val;
		}
		return decodeURLComponents ? decodeURIComponent(val.replace(/\+/g, ' ')) : val;
	}

	function Context(path, state) {
		var pageBase = getBase();
		if ('/' === path[0] && 0 !== path.indexOf(pageBase)) path = pageBase + (hashbang ? '#!' : '') + path;
		var i = path.indexOf('?');
		this.canonicalPath = path;
		this.path = path.replace(pageBase, '') || '/';
		if (hashbang) this.path = this.path.replace('#!', '') || '/';
		this.title = (hasDocument && pageWindow.document.title);
		this.state = state || {};
		this.state.path = path;
		this.querystring = ~i ? decodeURLEncodedURIComponent(path.slice(i + 1)) : '';
		this.pathname = decodeURLEncodedURIComponent(~i ? path.slice(0, i) : path);
		this.params = {};
		this.hash = '';
		if (!hashbang) {
			if (!~this.path.indexOf('#')) return;
			var parts = this.path.split('#');
			this.path = this.pathname = parts[0];
			this.hash = decodeURLEncodedURIComponent(parts[1]) || '';
			this.querystring = this.querystring.split('#')[0];
		}
	}
	page.Context = Context;
	Context.prototype.pushState = function () {
		page.len++;
		if (hasHistory) {
			pageWindow.history.pushState(this.state, this.title, hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
		}
	};
	Context.prototype.save = function () {
		if (hasHistory && pageWindow.location.protocol !== 'file:') {
			pageWindow.history.replaceState(this.state, this.title, hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
		}
	};

	function Route(path, options) {
		options = options || {};
		options.strict = options.strict || strict;
		this.path = (path === '*') ? '(.*)' : path;
		this.method = 'GET';
		this.regexp = pathToRegexp_1(this.path, this.keys = [], options);
	}
	page.Route = Route;
	Route.prototype.middleware = function (fn) {
		var self = this;
		return function (ctx, next) {
			if (self.match(ctx.path, ctx.params)) return fn(ctx, next);
			next();
		};
	};
	Route.prototype.match = function (path, params) {
		var keys = this.keys,
			qsIndex = path.indexOf('?'),
			pathname = ~qsIndex ? path.slice(0, qsIndex) : path,
			m = this.regexp.exec(decodeURIComponent(pathname));
		if (!m) return false;
		for (var i = 1, len = m.length; i < len; ++i) {
			var key = keys[i - 1];
			var val = decodeURLEncodedURIComponent(m[i]);
			if (val !== undefined || !(hasOwnProperty.call(params, key.name))) {
				params[key.name] = val;
			}
		}
		return true;
	};
	var onpopstate = (function () {
		var loaded = false;
		if (!hasWindow) {
			return;
		}
		if (hasDocument && document.readyState === 'complete') {
			loaded = true;
		} else {
			window.addEventListener('load', function () {
				setTimeout(function () {
					loaded = true;
				}, 0);
			});
		}
		return function onpopstate(e) {
			if (!loaded) return;
			if (e.state) {
				var path = e.state.path;
				page.replace(path, e.state);
			} else if (isLocation) {
				var loc = pageWindow.location;
				page.show(loc.pathname + loc.hash, undefined, undefined, false);
			}
		};
	})();

	function onclick(e) {
		if (1 !== which(e)) return;
		if (e.metaKey || e.ctrlKey || e.shiftKey) return;
		if (e.defaultPrevented) return;
		var el = e.path ? e.path[0] : e.target;
		while (el && 'A' !== el.nodeName.toUpperCase()) el = el.parentNode;
		if (!el || 'A' !== el.nodeName.toUpperCase()) return;
		var svg = (typeof el.href === 'object') && el.href.constructor.name === 'SVGAnimatedString';
		if (el.hasAttribute('download') || el.getAttribute('rel') === 'external') return;
		var link = el.getAttribute('href');
		if (!hashbang && samePath(el) && (el.hash || '#' === link)) return;
		if (link && link.indexOf('mailto:') > -1) return;
		if (svg ? el.target.baseVal : el.target) return;
		if (!svg && !sameOrigin(el.href)) return;
		var path = svg ? el.href.baseVal : (el.pathname + el.search + (el.hash || ''));
		path = path[0] !== '/' ? '/' + path : path;
		if (hasProcess && path.match(/^\/[a-zA-Z]:\//)) {
			path = path.replace(/^\/[a-zA-Z]:\//, '/');
		}
		var orig = path;
		var pageBase = getBase();
		if (path.indexOf(pageBase) === 0) {
			path = path.substr(base.length);
		}
		if (hashbang) path = path.replace('#!', '');
		if (pageBase && orig === path) return;
		e.preventDefault();
		page.show(orig);
	}

	function which(e) {
		e = e || (hasWindow && window.event);
		return null == e.which ? e.button : e.which;
	}

	function toURL(href) {
		if (typeof URL === 'function' && isLocation) {
			return new URL(href, location.toString());
		} else if (hasDocument) {
			var anc = document.createElement('a');
			anc.href = href;
			return anc;
		}
	}

	function sameOrigin(href) {
		if (!href || !isLocation) return false;
		var url = toURL(href);
		var loc = pageWindow.location;
		return loc.protocol === url.protocol && loc.hostname === url.hostname && loc.port === url.port;
	}

	function samePath(url) {
		if (!isLocation) return false;
		var loc = pageWindow.location;
		return url.pathname === loc.pathname && url.search === loc.search;
	}

	function getBase() {
		if (!!base) return base;
		var loc = hasWindow && pageWindow.location;
		return (hasWindow && hashbang && loc.protocol === 'file:') ? loc.pathname : base;
	}
	page.sameOrigin = sameOrigin;
	return page_js;
})));;
(function (f) {
	if (typeof exports === "object" && typeof module !== "undefined") {
		module.exports = f()
	} else if (typeof define === "function" && define.amd) {
		define([], f)
	} else {
		var g;
		if (typeof window !== "undefined") {
			g = window
		} else if (typeof global !== "undefined") {
			g = global
		} else if (typeof self !== "undefined") {
			g = self
		} else {
			g = this
		}
		g.Qs = f()
	}
})(function () {
	var define, module, exports;
	return (function e(t, n, r) {
		function s(o, u) {
			if (!n[o]) {
				if (!t[o]) {
					var a = typeof require == "function" && require;
					if (!u && a) return a(o, !0);
					if (i) return i(o, !0);
					var f = new Error("Cannot find module '" + o + "'");
					throw f.code = "MODULE_NOT_FOUND", f
				}
				var l = n[o] = {
					exports: {}
				};
				t[o][0].call(l.exports, function (e) {
					var n = t[o][1][e];
					return s(n ? n : e)
				}, l, l.exports, e, t, n, r)
			}
			return n[o].exports
		}
		var i = typeof require == "function" && require;
		for (var o = 0; o < r.length; o++) s(r[o]);
		return s
	})({
		1: [function (require, module, exports) {
			'use strict';
			var replace = String.prototype.replace;
			var percentTwenties = /%20/g;
			module.exports = {
				'default': 'RFC3986',
				formatters: {
					RFC1738: function (value) {
						return replace.call(value, percentTwenties, '+');
					},
					RFC3986: function (value) {
						return value;
					}
				},
				RFC1738: 'RFC1738',
				RFC3986: 'RFC3986'
			};
		}, {}],
		2: [function (require, module, exports) {
			'use strict';
			var stringify = require('./stringify');
			var parse = require('./parse');
			var formats = require('./formats');
			module.exports = {
				formats: formats,
				parse: parse,
				stringify: stringify
			};
		}, {
			"./formats": 1,
			"./parse": 3,
			"./stringify": 4
		}],
		3: [function (require, module, exports) {
			'use strict';
			var utils = require('./utils');
			var has = Object.prototype.hasOwnProperty;
			var defaults = {
				allowDots: false,
				allowPrototypes: false,
				arrayLimit: 20,
				decoder: utils.decode,
				delimiter: '&',
				depth: 5,
				parameterLimit: 1000,
				plainObjects: false,
				strictNullHandling: false
			};
			var parseValues = function parseQueryStringValues(str, options) {
				var obj = {};
				var cleanStr = options.ignoreQueryPrefix ? str.replace(/^\?/, '') : str;
				var limit = options.parameterLimit === Infinity ? undefined : options.parameterLimit;
				var parts = cleanStr.split(options.delimiter, limit);
				for (var i = 0; i < parts.length; ++i) {
					var part = parts[i];
					var bracketEqualsPos = part.indexOf(']=');
					var pos = bracketEqualsPos === -1 ? part.indexOf('=') : bracketEqualsPos + 1;
					var key, val;
					if (pos === -1) {
						key = options.decoder(part, defaults.decoder);
						val = options.strictNullHandling ? null : '';
					} else {
						key = options.decoder(part.slice(0, pos), defaults.decoder);
						val = options.decoder(part.slice(pos + 1), defaults.decoder);
					}
					if (has.call(obj, key)) {
						obj[key] = [].concat(obj[key]).concat(val);
					} else {
						obj[key] = val;
					}
				}
				return obj;
			};
			var parseObject = function parseObjectRecursive(chain, val, options) {
				if (!chain.length) {
					return val;
				}
				var root = chain.shift();
				var obj;
				if (root === '[]') {
					obj = [];
					obj = obj.concat(parseObject(chain, val, options));
				} else {
					obj = options.plainObjects ? Object.create(null) : {};
					var cleanRoot = root.charAt(0) === '[' && root.charAt(root.length - 1) === ']' ? root.slice(1, -1) : root;
					var index = parseInt(cleanRoot, 10);
					if (!isNaN(index) && root !== cleanRoot && String(index) === cleanRoot && index >= 0 && (options.parseArrays && index <= options.arrayLimit)) {
						obj = [];
						obj[index] = parseObject(chain, val, options);
					} else {
						obj[cleanRoot] = parseObject(chain, val, options);
					}
				}
				return obj;
			};
			var parseKeys = function parseQueryStringKeys(givenKey, val, options) {
				if (!givenKey) {
					return;
				}
				var key = options.allowDots ? givenKey.replace(/\.([^.[]+)/g, '[$1]') : givenKey;
				var brackets = /(\[[^[\]]*])/;
				var child = /(\[[^[\]]*])/g;
				var segment = brackets.exec(key);
				var parent = segment ? key.slice(0, segment.index) : key;
				var keys = [];
				if (parent) {
					if (!options.plainObjects && has.call(Object.prototype, parent)) {
						if (!options.allowPrototypes) {
							return;
						}
					}
					keys.push(parent);
				}
				var i = 0;
				while ((segment = child.exec(key)) !== null && i < options.depth) {
					i += 1;
					if (!options.plainObjects && has.call(Object.prototype, segment[1].slice(1, -1))) {
						if (!options.allowPrototypes) {
							return;
						}
					}
					keys.push(segment[1]);
				}
				if (segment) {
					keys.push('[' + key.slice(segment.index) + ']');
				}
				return parseObject(keys, val, options);
			};
			module.exports = function (str, opts) {
				var options = opts ? utils.assign({}, opts) : {};
				if (options.decoder !== null && options.decoder !== undefined && typeof options.decoder !== 'function') {
					throw new TypeError('Decoder has to be a function.');
				}
				options.ignoreQueryPrefix = options.ignoreQueryPrefix === true;
				options.delimiter = typeof options.delimiter === 'string' || utils.isRegExp(options.delimiter) ? options.delimiter : defaults.delimiter;
				options.depth = typeof options.depth === 'number' ? options.depth : defaults.depth;
				options.arrayLimit = typeof options.arrayLimit === 'number' ? options.arrayLimit : defaults.arrayLimit;
				options.parseArrays = options.parseArrays !== false;
				options.decoder = typeof options.decoder === 'function' ? options.decoder : defaults.decoder;
				options.allowDots = typeof options.allowDots === 'boolean' ? options.allowDots : defaults.allowDots;
				options.plainObjects = typeof options.plainObjects === 'boolean' ? options.plainObjects : defaults.plainObjects;
				options.allowPrototypes = typeof options.allowPrototypes === 'boolean' ? options.allowPrototypes : defaults.allowPrototypes;
				options.parameterLimit = typeof options.parameterLimit === 'number' ? options.parameterLimit : defaults.parameterLimit;
				options.strictNullHandling = typeof options.strictNullHandling === 'boolean' ? options.strictNullHandling : defaults.strictNullHandling;
				if (str === '' || str === null || typeof str === 'undefined') {
					return options.plainObjects ? Object.create(null) : {};
				}
				var tempObj = typeof str === 'string' ? parseValues(str, options) : str;
				var obj = options.plainObjects ? Object.create(null) : {};
				var keys = Object.keys(tempObj);
				for (var i = 0; i < keys.length; ++i) {
					var key = keys[i];
					var newObj = parseKeys(key, tempObj[key], options);
					obj = utils.merge(obj, newObj, options);
				}
				return utils.compact(obj);
			};
		}, {
			"./utils": 5
		}],
		4: [function (require, module, exports) {
			'use strict';
			var utils = require('./utils');
			var formats = require('./formats');
			var arrayPrefixGenerators = {
				brackets: function brackets(prefix) {
					return prefix + '[]';
				},
				indices: function indices(prefix, key) {
					return prefix + '[' + key + ']';
				},
				repeat: function repeat(prefix) {
					return prefix;
				}
			};
			var toISO = Date.prototype.toISOString;
			var defaults = {
				delimiter: '&',
				encode: true,
				encoder: utils.encode,
				encodeValuesOnly: false,
				serializeDate: function serializeDate(date) {
					return toISO.call(date);
				},
				skipNulls: false,
				strictNullHandling: false
			};
			var stringify = function stringify(object, prefix, generateArrayPrefix, strictNullHandling, skipNulls, encoder, filter, sort, allowDots, serializeDate, formatter, encodeValuesOnly) {
				var obj = object;
				if (typeof filter === 'function') {
					obj = filter(prefix, obj);
				} else if (obj instanceof Date) {
					obj = serializeDate(obj);
				} else if (obj === null) {
					if (strictNullHandling) {
						return encoder && !encodeValuesOnly ? encoder(prefix, defaults.encoder) : prefix;
					}
					obj = '';
				}
				if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' || utils.isBuffer(obj)) {
					if (encoder) {
						var keyValue = encodeValuesOnly ? prefix : encoder(prefix, defaults.encoder);
						return [formatter(keyValue) + '=' + formatter(encoder(obj, defaults.encoder))];
					}
					return [formatter(prefix) + '=' + formatter(String(obj))];
				}
				var values = [];
				if (typeof obj === 'undefined') {
					return values;
				}
				var objKeys;
				if (Array.isArray(filter)) {
					objKeys = filter;
				} else {
					var keys = Object.keys(obj);
					objKeys = sort ? keys.sort(sort) : keys;
				}
				for (var i = 0; i < objKeys.length; ++i) {
					var key = objKeys[i];
					if (skipNulls && obj[key] === null) {
						continue;
					}
					if (Array.isArray(obj)) {
						values = values.concat(stringify(obj[key], generateArrayPrefix(prefix, key), generateArrayPrefix, strictNullHandling, skipNulls, encoder, filter, sort, allowDots, serializeDate, formatter, encodeValuesOnly));
					} else {
						values = values.concat(stringify(obj[key], prefix + (allowDots ? '.' + key : '[' + key + ']'), generateArrayPrefix, strictNullHandling, skipNulls, encoder, filter, sort, allowDots, serializeDate, formatter, encodeValuesOnly));
					}
				}
				return values;
			};
			module.exports = function (object, opts) {
				var obj = object;
				var options = opts ? utils.assign({}, opts) : {};
				if (options.encoder !== null && options.encoder !== undefined && typeof options.encoder !== 'function') {
					throw new TypeError('Encoder has to be a function.');
				}
				var delimiter = typeof options.delimiter === 'undefined' ? defaults.delimiter : options.delimiter;
				var strictNullHandling = typeof options.strictNullHandling === 'boolean' ? options.strictNullHandling : defaults.strictNullHandling;
				var skipNulls = typeof options.skipNulls === 'boolean' ? options.skipNulls : defaults.skipNulls;
				var encode = typeof options.encode === 'boolean' ? options.encode : defaults.encode;
				var encoder = typeof options.encoder === 'function' ? options.encoder : defaults.encoder;
				var sort = typeof options.sort === 'function' ? options.sort : null;
				var allowDots = typeof options.allowDots === 'undefined' ? false : options.allowDots;
				var serializeDate = typeof options.serializeDate === 'function' ? options.serializeDate : defaults.serializeDate;
				var encodeValuesOnly = typeof options.encodeValuesOnly === 'boolean' ? options.encodeValuesOnly : defaults.encodeValuesOnly;
				if (typeof options.format === 'undefined') {
					options.format = formats.default;
				} else if (!Object.prototype.hasOwnProperty.call(formats.formatters, options.format)) {
					throw new TypeError('Unknown format option provided.');
				}
				var formatter = formats.formatters[options.format];
				var objKeys;
				var filter;
				if (typeof options.filter === 'function') {
					filter = options.filter;
					obj = filter('', obj);
				} else if (Array.isArray(options.filter)) {
					filter = options.filter;
					objKeys = filter;
				}
				var keys = [];
				if (typeof obj !== 'object' || obj === null) {
					return '';
				}
				var arrayFormat;
				if (options.arrayFormat in arrayPrefixGenerators) {
					arrayFormat = options.arrayFormat;
				} else if ('indices' in options) {
					arrayFormat = options.indices ? 'indices' : 'repeat';
				} else {
					arrayFormat = 'indices';
				}
				var generateArrayPrefix = arrayPrefixGenerators[arrayFormat];
				if (!objKeys) {
					objKeys = Object.keys(obj);
				}
				if (sort) {
					objKeys.sort(sort);
				}
				for (var i = 0; i < objKeys.length; ++i) {
					var key = objKeys[i];
					if (skipNulls && obj[key] === null) {
						continue;
					}
					keys = keys.concat(stringify(obj[key], key, generateArrayPrefix, strictNullHandling, skipNulls, encode ? encoder : null, filter, sort, allowDots, serializeDate, formatter, encodeValuesOnly));
				}
				var joined = keys.join(delimiter);
				var prefix = options.addQueryPrefix === true ? '?' : '';
				return joined.length > 0 ? prefix + joined : '';
			};
		}, {
			"./formats": 1,
			"./utils": 5
		}],
		5: [function (require, module, exports) {
			'use strict';
			var has = Object.prototype.hasOwnProperty;
			var hexTable = (function () {
				var array = [];
				for (var i = 0; i < 256; ++i) {
					array.push('%' + ((i < 16 ? '0' : '') + i.toString(16)).toUpperCase());
				}
				return array;
			}());
			exports.arrayToObject = function (source, options) {
				var obj = options && options.plainObjects ? Object.create(null) : {};
				for (var i = 0; i < source.length; ++i) {
					if (typeof source[i] !== 'undefined') {
						obj[i] = source[i];
					}
				}
				return obj;
			};
			exports.merge = function (target, source, options) {
				if (!source) {
					return target;
				}
				if (typeof source !== 'object') {
					if (Array.isArray(target)) {
						target.push(source);
					} else if (typeof target === 'object') {
						if (options.plainObjects || options.allowPrototypes || !has.call(Object.prototype, source)) {
							target[source] = true;
						}
					} else {
						return [target, source];
					}
					return target;
				}
				if (typeof target !== 'object') {
					return [target].concat(source);
				}
				var mergeTarget = target;
				if (Array.isArray(target) && !Array.isArray(source)) {
					mergeTarget = exports.arrayToObject(target, options);
				}
				if (Array.isArray(target) && Array.isArray(source)) {
					source.forEach(function (item, i) {
						if (has.call(target, i)) {
							if (target[i] && typeof target[i] === 'object') {
								target[i] = exports.merge(target[i], item, options);
							} else {
								target.push(item);
							}
						} else {
							target[i] = item;
						}
					});
					return target;
				}
				return Object.keys(source).reduce(function (acc, key) {
					var value = source[key];
					if (has.call(acc, key)) {
						acc[key] = exports.merge(acc[key], value, options);
					} else {
						acc[key] = value;
					}
					return acc;
				}, mergeTarget);
			};
			exports.assign = function assignSingleSource(target, source) {
				return Object.keys(source).reduce(function (acc, key) {
					acc[key] = source[key];
					return acc;
				}, target);
			};
			exports.decode = function (str) {
				try {
					return decodeURIComponent(str.replace(/\+/g, ' '));
				} catch (e) {
					return str;
				}
			};
			exports.encode = function (str) {
				if (str.length === 0) {
					return str;
				}
				var string = typeof str === 'string' ? str : String(str);
				var out = '';
				for (var i = 0; i < string.length; ++i) {
					var c = string.charCodeAt(i);
					if (c === 0x2D || c === 0x2E || c === 0x5F || c === 0x7E || (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)) {
						out += string.charAt(i);
						continue;
					}
					if (c < 0x80) {
						out = out + hexTable[c];
						continue;
					}
					if (c < 0x800) {
						out = out + (hexTable[0xC0 | (c >> 6)] + hexTable[0x80 | (c & 0x3F)]);
						continue;
					}
					if (c < 0xD800 || c >= 0xE000) {
						out = out + (hexTable[0xE0 | (c >> 12)] + hexTable[0x80 | ((c >> 6) & 0x3F)] + hexTable[0x80 | (c & 0x3F)]);
						continue;
					}
					i += 1;
					c = 0x10000 + (((c & 0x3FF) << 10) | (string.charCodeAt(i) & 0x3FF));
					out += hexTable[0xF0 | (c >> 18)] + hexTable[0x80 | ((c >> 12) & 0x3F)] + hexTable[0x80 | ((c >> 6) & 0x3F)] + hexTable[0x80 | (c & 0x3F)];
				}
				return out;
			};
			exports.compact = function (obj, references) {
				if (typeof obj !== 'object' || obj === null) {
					return obj;
				}
				var refs = references || [];
				var lookup = refs.indexOf(obj);
				if (lookup !== -1) {
					return refs[lookup];
				}
				refs.push(obj);
				if (Array.isArray(obj)) {
					var compacted = [];
					for (var i = 0; i < obj.length; ++i) {
						if (obj[i] && typeof obj[i] === 'object') {
							compacted.push(exports.compact(obj[i], refs));
						} else if (typeof obj[i] !== 'undefined') {
							compacted.push(obj[i]);
						}
					}
					return compacted;
				}
				var keys = Object.keys(obj);
				keys.forEach(function (key) {
					obj[key] = exports.compact(obj[key], refs);
				});
				return obj;
			};
			exports.isRegExp = function (obj) {
				return Object.prototype.toString.call(obj) === '[object RegExp]';
			};
			exports.isBuffer = function (obj) {
				if (obj === null || typeof obj === 'undefined') {
					return false;
				}
				return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
			};
		}, {}]
	}, {}, [2])(2)
});;;
(function () {
	function n(n, t, r) {
		switch (r.length) {
			case 0:
				return n.call(t);
			case 1:
				return n.call(t, r[0]);
			case 2:
				return n.call(t, r[0], r[1]);
			case 3:
				return n.call(t, r[0], r[1], r[2])
		}
		return n.apply(t, r)
	}

	function t(n, t, r, e) {
		for (var u = -1, i = null == n ? 0 : n.length; ++u < i;) {
			var o = n[u];
			t(e, o, r(o), n)
		}
		return e
	}

	function r(n, t) {
		for (var r = -1, e = null == n ? 0 : n.length; ++r < e && false !== t(n[r], r, n););
		return n
	}

	function e(n, t) {
		for (var r = null == n ? 0 : n.length; r-- && false !== t(n[r], r, n););
		return n
	}

	function u(n, t) {
		for (var r = -1, e = null == n ? 0 : n.length; ++r < e;)
			if (!t(n[r], r, n)) return false;
		return true
	}

	function i(n, t) {
		for (var r = -1, e = null == n ? 0 : n.length, u = 0, i = []; ++r < e;) {
			var o = n[r];
			t(o, r, n) && (i[u++] = o)
		}
		return i
	}

	function o(n, t) {
		return !(null == n || !n.length) && -1 < v(n, t, 0)
	}

	function f(n, t, r) {
		for (var e = -1, u = null == n ? 0 : n.length; ++e < u;)
			if (r(t, n[e])) return true;
		return false
	}

	function c(n, t) {
		for (var r = -1, e = null == n ? 0 : n.length, u = Array(e); ++r < e;) u[r] = t(n[r], r, n);
		return u
	}

	function a(n, t) {
		for (var r = -1, e = t.length, u = n.length; ++r < e;) n[u + r] = t[r];
		return n
	}

	function l(n, t, r, e) {
		var u = -1,
			i = null == n ? 0 : n.length;
		for (e && i && (r = n[++u]); ++u < i;) r = t(r, n[u], u, n);
		return r
	}

	function s(n, t, r, e) {
		var u = null == n ? 0 : n.length;
		for (e && u && (r = n[--u]); u--;) r = t(r, n[u], u, n);
		return r
	}

	function h(n, t) {
		for (var r = -1, e = null == n ? 0 : n.length; ++r < e;)
			if (t(n[r], r, n)) return true;
		return false
	}

	function p(n, t, r) {
		var e;
		return r(n, function (n, r, u) {
			if (t(n, r, u)) return e = r, false
		}), e
	}

	function _(n, t, r, e) {
		var u = n.length;
		for (r += e ? 1 : -1; e ? r-- : ++r < u;)
			if (t(n[r], r, n)) return r;
		return -1
	}

	function v(n, t, r) {
		if (t === t) n: {
			--r;
			for (var e = n.length; ++r < e;)
				if (n[r] === t) {
					n = r;
					break n
				}
			n = -1
		}
		else n = _(n, d, r);
		return n
	}

	function g(n, t, r, e) {
		--r;
		for (var u = n.length; ++r < u;)
			if (e(n[r], t)) return r;
		return -1
	}

	function d(n) {
		return n !== n
	}

	function y(n, t) {
		var r = null == n ? 0 : n.length;
		return r ? m(n, t) / r : F
	}

	function b(n) {
		return function (t) {
			return null == t ? T : t[n]
		}
	}

	function x(n) {
		return function (t) {
			return null == n ? T : n[t]
		}
	}

	function j(n, t, r, e, u) {
		return u(n, function (n, u, i) {
			r = e ? (e = false, n) : t(r, n, u, i)
		}), r
	}

	function w(n, t) {
		var r = n.length;
		for (n.sort(t); r--;) n[r] = n[r].c;
		return n
	}

	function m(n, t) {
		for (var r, e = -1, u = n.length; ++e < u;) {
			var i = t(n[e]);
			i !== T && (r = r === T ? i : r + i)
		}
		return r;
	}

	function A(n, t) {
		for (var r = -1, e = Array(n); ++r < n;) e[r] = t(r);
		return e
	}

	function k(n, t) {
		return c(t, function (t) {
			return [t, n[t]]
		})
	}

	function E(n) {
		return function (t) {
			return n(t)
		}
	}

	function S(n, t) {
		return c(t, function (t) {
			return n[t]
		})
	}

	function O(n, t) {
		return n.has(t)
	}

	function I(n, t) {
		for (var r = -1, e = n.length; ++r < e && -1 < v(t, n[r], 0););
		return r
	}

	function R(n, t) {
		for (var r = n.length; r-- && -1 < v(t, n[r], 0););
		return r
	}

	function z(n) {
		return "\\" + Cn[n]
	}

	function W(n) {
		var t = -1,
			r = Array(n.size);
		return n.forEach(function (n, e) {
			r[++t] = [e, n];
		}), r
	}

	function B(n, t) {
		return function (r) {
			return n(t(r))
		}
	}

	function L(n, t) {
		for (var r = -1, e = n.length, u = 0, i = []; ++r < e;) {
			var o = n[r];
			o !== t && "__lodash_placeholder__" !== o || (n[r] = "__lodash_placeholder__", i[u++] = r)
		}
		return i
	}

	function U(n) {
		var t = -1,
			r = Array(n.size);
		return n.forEach(function (n) {
			r[++t] = n
		}), r
	}

	function C(n) {
		var t = -1,
			r = Array(n.size);
		return n.forEach(function (n) {
			r[++t] = [n, n]
		}), r
	}

	function D(n) {
		if (Rn.test(n)) {
			for (var t = On.lastIndex = 0; On.test(n);) ++t;
			n = t
		} else n = Qn(n);
		return n
	}

	function M(n) {
		return Rn.test(n) ? n.match(On) || [] : n.split("");
	}
	var T, $ = 1 / 0,
		F = NaN,
		N = [
			["ary", 128],
			["bind", 1],
			["bindKey", 2],
			["curry", 8],
			["curryRight", 16],
			["flip", 512],
			["partial", 32],
			["partialRight", 64],
			["rearg", 256]
		],
		P = /\b__p\+='';/g,
		Z = /\b(__p\+=)''\+/g,
		q = /(__e\(.*?\)|\b__t\))\+'';/g,
		V = /&(?:amp|lt|gt|quot|#39);/g,
		K = /[&<>"']/g,
		G = RegExp(V.source),
		H = RegExp(K.source),
		J = /<%-([\s\S]+?)%>/g,
		Y = /<%([\s\S]+?)%>/g,
		Q = /<%=([\s\S]+?)%>/g,
		X = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
		nn = /^\w*$/,
		tn = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,
		rn = /[\\^$.*+?()[\]{}|]/g,
		en = RegExp(rn.source),
		un = /^\s+|\s+$/g,
		on = /^\s+/,
		fn = /\s+$/,
		cn = /\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/,
		an = /\{\n\/\* \[wrapped with (.+)\] \*/,
		ln = /,? & /,
		sn = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g,
		hn = /\\(\\)?/g,
		pn = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g,
		_n = /\w*$/,
		vn = /^[-+]0x[0-9a-f]+$/i,
		gn = /^0b[01]+$/i,
		dn = /^\[object .+?Constructor\]$/,
		yn = /^0o[0-7]+$/i,
		bn = /^(?:0|[1-9]\d*)$/,
		xn = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g,
		jn = /($^)/,
		wn = /['\n\r\u2028\u2029\\]/g,
		mn = "[\\ufe0e\\ufe0f]?(?:[\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff]|\\ud83c[\\udffb-\\udfff])?(?:\\u200d(?:[^\\ud800-\\udfff]|(?:\\ud83c[\\udde6-\\uddff]){2}|[\\ud800-\\udbff][\\udc00-\\udfff])[\\ufe0e\\ufe0f]?(?:[\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff]|\\ud83c[\\udffb-\\udfff])?)*",
		An = "(?:[\\u2700-\\u27bf]|(?:\\ud83c[\\udde6-\\uddff]){2}|[\\ud800-\\udbff][\\udc00-\\udfff])" + mn,
		kn = "(?:[^\\ud800-\\udfff][\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff]?|[\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff]|(?:\\ud83c[\\udde6-\\uddff]){2}|[\\ud800-\\udbff][\\udc00-\\udfff]|[\\ud800-\\udfff])",
		En = RegExp("['\u2019]", "g"),
		Sn = RegExp("[\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff]", "g"),
		On = RegExp("\\ud83c[\\udffb-\\udfff](?=\\ud83c[\\udffb-\\udfff])|" + kn + mn, "g"),
		In = RegExp(["[A-Z\\xc0-\\xd6\\xd8-\\xde]?[a-z\\xdf-\\xf6\\xf8-\\xff]+(?:['\u2019](?:d|ll|m|re|s|t|ve))?(?=[\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000]|[A-Z\\xc0-\\xd6\\xd8-\\xde]|$)|(?:[A-Z\\xc0-\\xd6\\xd8-\\xde]|[^\\ud800-\\udfff\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000\\d+\\u2700-\\u27bfa-z\\xdf-\\xf6\\xf8-\\xffA-Z\\xc0-\\xd6\\xd8-\\xde])+(?:['\u2019](?:D|LL|M|RE|S|T|VE))?(?=[\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000]|[A-Z\\xc0-\\xd6\\xd8-\\xde](?:[a-z\\xdf-\\xf6\\xf8-\\xff]|[^\\ud800-\\udfff\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000\\d+\\u2700-\\u27bfa-z\\xdf-\\xf6\\xf8-\\xffA-Z\\xc0-\\xd6\\xd8-\\xde])|$)|[A-Z\\xc0-\\xd6\\xd8-\\xde]?(?:[a-z\\xdf-\\xf6\\xf8-\\xff]|[^\\ud800-\\udfff\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000\\d+\\u2700-\\u27bfa-z\\xdf-\\xf6\\xf8-\\xffA-Z\\xc0-\\xd6\\xd8-\\xde])+(?:['\u2019](?:d|ll|m|re|s|t|ve))?|[A-Z\\xc0-\\xd6\\xd8-\\xde]+(?:['\u2019](?:D|LL|M|RE|S|T|VE))?|\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])|\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])|\\d+", An].join("|"), "g"),
		Rn = RegExp("[\\u200d\\ud800-\\udfff\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff\\ufe0e\\ufe0f]"),
		zn = /[a-z][A-Z]|[A-Z]{2,}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/,
		Wn = "Array Buffer DataView Date Error Float32Array Float64Array Function Int8Array Int16Array Int32Array Map Math Object Promise RegExp Set String Symbol TypeError Uint8Array Uint8ClampedArray Uint16Array Uint32Array WeakMap _ clearTimeout isFinite parseInt setTimeout".split(" "),
		Bn = {};
	Bn["[object Float32Array]"] = Bn["[object Float64Array]"] = Bn["[object Int8Array]"] = Bn["[object Int16Array]"] = Bn["[object Int32Array]"] = Bn["[object Uint8Array]"] = Bn["[object Uint8ClampedArray]"] = Bn["[object Uint16Array]"] = Bn["[object Uint32Array]"] = true, Bn["[object Arguments]"] = Bn["[object Array]"] = Bn["[object ArrayBuffer]"] = Bn["[object Boolean]"] = Bn["[object DataView]"] = Bn["[object Date]"] = Bn["[object Error]"] = Bn["[object Function]"] = Bn["[object Map]"] = Bn["[object Number]"] = Bn["[object Object]"] = Bn["[object RegExp]"] = Bn["[object Set]"] = Bn["[object String]"] = Bn["[object WeakMap]"] = false;
	var Ln = {};
	Ln["[object Arguments]"] = Ln["[object Array]"] = Ln["[object ArrayBuffer]"] = Ln["[object DataView]"] = Ln["[object Boolean]"] = Ln["[object Date]"] = Ln["[object Float32Array]"] = Ln["[object Float64Array]"] = Ln["[object Int8Array]"] = Ln["[object Int16Array]"] = Ln["[object Int32Array]"] = Ln["[object Map]"] = Ln["[object Number]"] = Ln["[object Object]"] = Ln["[object RegExp]"] = Ln["[object Set]"] = Ln["[object String]"] = Ln["[object Symbol]"] = Ln["[object Uint8Array]"] = Ln["[object Uint8ClampedArray]"] = Ln["[object Uint16Array]"] = Ln["[object Uint32Array]"] = true, Ln["[object Error]"] = Ln["[object Function]"] = Ln["[object WeakMap]"] = false;
	var Un, Cn = {
			"\\": "\\",
			"'": "'",
			"\n": "n",
			"\r": "r",
			"\u2028": "u2028",
			"\u2029": "u2029"
		},
		Dn = parseFloat,
		Mn = parseInt,
		Tn = typeof global == "object" && global && global.Object === Object && global,
		$n = typeof self == "object" && self && self.Object === Object && self,
		Fn = Tn || $n || Function("return this")(),
		Nn = typeof exports == "object" && exports && !exports.nodeType && exports,
		Pn = Nn && typeof module == "object" && module && !module.nodeType && module,
		Zn = Pn && Pn.exports === Nn,
		qn = Zn && Tn.process;
	n: {
		try {
			Un = qn && qn.binding && qn.binding("util");
			break n
		} catch (n) {}
		Un = void 0
	}
	var Vn = Un && Un.isArrayBuffer,
		Kn = Un && Un.isDate,
		Gn = Un && Un.isMap,
		Hn = Un && Un.isRegExp,
		Jn = Un && Un.isSet,
		Yn = Un && Un.isTypedArray,
		Qn = b("length"),
		Xn = x({
			"\xc0": "A",
			"\xc1": "A",
			"\xc2": "A",
			"\xc3": "A",
			"\xc4": "A",
			"\xc5": "A",
			"\xe0": "a",
			"\xe1": "a",
			"\xe2": "a",
			"\xe3": "a",
			"\xe4": "a",
			"\xe5": "a",
			"\xc7": "C",
			"\xe7": "c",
			"\xd0": "D",
			"\xf0": "d",
			"\xc8": "E",
			"\xc9": "E",
			"\xca": "E",
			"\xcb": "E",
			"\xe8": "e",
			"\xe9": "e",
			"\xea": "e",
			"\xeb": "e",
			"\xcc": "I",
			"\xcd": "I",
			"\xce": "I",
			"\xcf": "I",
			"\xec": "i",
			"\xed": "i",
			"\xee": "i",
			"\xef": "i",
			"\xd1": "N",
			"\xf1": "n",
			"\xd2": "O",
			"\xd3": "O",
			"\xd4": "O",
			"\xd5": "O",
			"\xd6": "O",
			"\xd8": "O",
			"\xf2": "o",
			"\xf3": "o",
			"\xf4": "o",
			"\xf5": "o",
			"\xf6": "o",
			"\xf8": "o",
			"\xd9": "U",
			"\xda": "U",
			"\xdb": "U",
			"\xdc": "U",
			"\xf9": "u",
			"\xfa": "u",
			"\xfb": "u",
			"\xfc": "u",
			"\xdd": "Y",
			"\xfd": "y",
			"\xff": "y",
			"\xc6": "Ae",
			"\xe6": "ae",
			"\xde": "Th",
			"\xfe": "th",
			"\xdf": "ss",
			"\u0100": "A",
			"\u0102": "A",
			"\u0104": "A",
			"\u0101": "a",
			"\u0103": "a",
			"\u0105": "a",
			"\u0106": "C",
			"\u0108": "C",
			"\u010a": "C",
			"\u010c": "C",
			"\u0107": "c",
			"\u0109": "c",
			"\u010b": "c",
			"\u010d": "c",
			"\u010e": "D",
			"\u0110": "D",
			"\u010f": "d",
			"\u0111": "d",
			"\u0112": "E",
			"\u0114": "E",
			"\u0116": "E",
			"\u0118": "E",
			"\u011a": "E",
			"\u0113": "e",
			"\u0115": "e",
			"\u0117": "e",
			"\u0119": "e",
			"\u011b": "e",
			"\u011c": "G",
			"\u011e": "G",
			"\u0120": "G",
			"\u0122": "G",
			"\u011d": "g",
			"\u011f": "g",
			"\u0121": "g",
			"\u0123": "g",
			"\u0124": "H",
			"\u0126": "H",
			"\u0125": "h",
			"\u0127": "h",
			"\u0128": "I",
			"\u012a": "I",
			"\u012c": "I",
			"\u012e": "I",
			"\u0130": "I",
			"\u0129": "i",
			"\u012b": "i",
			"\u012d": "i",
			"\u012f": "i",
			"\u0131": "i",
			"\u0134": "J",
			"\u0135": "j",
			"\u0136": "K",
			"\u0137": "k",
			"\u0138": "k",
			"\u0139": "L",
			"\u013b": "L",
			"\u013d": "L",
			"\u013f": "L",
			"\u0141": "L",
			"\u013a": "l",
			"\u013c": "l",
			"\u013e": "l",
			"\u0140": "l",
			"\u0142": "l",
			"\u0143": "N",
			"\u0145": "N",
			"\u0147": "N",
			"\u014a": "N",
			"\u0144": "n",
			"\u0146": "n",
			"\u0148": "n",
			"\u014b": "n",
			"\u014c": "O",
			"\u014e": "O",
			"\u0150": "O",
			"\u014d": "o",
			"\u014f": "o",
			"\u0151": "o",
			"\u0154": "R",
			"\u0156": "R",
			"\u0158": "R",
			"\u0155": "r",
			"\u0157": "r",
			"\u0159": "r",
			"\u015a": "S",
			"\u015c": "S",
			"\u015e": "S",
			"\u0160": "S",
			"\u015b": "s",
			"\u015d": "s",
			"\u015f": "s",
			"\u0161": "s",
			"\u0162": "T",
			"\u0164": "T",
			"\u0166": "T",
			"\u0163": "t",
			"\u0165": "t",
			"\u0167": "t",
			"\u0168": "U",
			"\u016a": "U",
			"\u016c": "U",
			"\u016e": "U",
			"\u0170": "U",
			"\u0172": "U",
			"\u0169": "u",
			"\u016b": "u",
			"\u016d": "u",
			"\u016f": "u",
			"\u0171": "u",
			"\u0173": "u",
			"\u0174": "W",
			"\u0175": "w",
			"\u0176": "Y",
			"\u0177": "y",
			"\u0178": "Y",
			"\u0179": "Z",
			"\u017b": "Z",
			"\u017d": "Z",
			"\u017a": "z",
			"\u017c": "z",
			"\u017e": "z",
			"\u0132": "IJ",
			"\u0133": "ij",
			"\u0152": "Oe",
			"\u0153": "oe",
			"\u0149": "'n",
			"\u017f": "s"
		}),
		nt = x({
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;"
		}),
		tt = x({
			"&amp;": "&",
			"&lt;": "<",
			"&gt;": ">",
			"&quot;": '"',
			"&#39;": "'"
		}),
		rt = function x(mn) {
			function An(n) {
				if (du(n) && ! of (n) && !(n instanceof Un)) {
					if (n instanceof On) return n;
					if (ii.call(n, "__wrapped__")) return $e(n)
				}
				return new On(n)
			}

			function kn() {}

			function On(n, t) {
				this.__wrapped__ = n, this.__actions__ = [], this.__chain__ = !!t, this.__index__ = 0, this.__values__ = T
			}

			function Un(n) {
				this.__wrapped__ = n, this.__actions__ = [], this.__dir__ = 1, this.__filtered__ = false, this.__iteratees__ = [], this.__takeCount__ = 4294967295, this.__views__ = []
			}

			function Cn(n) {
				var t = -1,
					r = null == n ? 0 : n.length;
				for (this.clear(); ++t < r;) {
					var e = n[t];
					this.set(e[0], e[1])
				}
			}

			function Tn(n) {
				var t = -1,
					r = null == n ? 0 : n.length;
				for (this.clear(); ++t < r;) {
					var e = n[t];
					this.set(e[0], e[1])
				}
			}

			function $n(n) {
				var t = -1,
					r = null == n ? 0 : n.length;
				for (this.clear(); ++t < r;) {
					var e = n[t];
					this.set(e[0], e[1])
				}
			}

			function Nn(n) {
				var t = -1,
					r = null == n ? 0 : n.length;
				for (this.__data__ = new $n; ++t < r;) this.add(n[t])
			}

			function Pn(n) {
				this.size = (this.__data__ = new Tn(n)).size
			}

			function qn(n, t) {
				var r, e = of (n),
					u = !e && uf(n),
					i = !e && !u && cf(n),
					o = !e && !u && !i && pf(n),
					u = (e = e || u || i || o) ? A(n.length, Xu) : [],
					f = u.length;
				for (r in n) !t && !ii.call(n, r) || e && ("length" == r || i && ("offset" == r || "parent" == r) || o && ("buffer" == r || "byteLength" == r || "byteOffset" == r) || Se(r, f)) || u.push(r);
				return u
			}

			function Qn(n) {
				var t = n.length;
				return t ? n[ir(0, t - 1)] : T
			}

			function et(n, t) {
				return Ce(Ur(n), pt(t, 0, n.length))
			}

			function ut(n) {
				return Ce(Ur(n))
			}

			function it(n, t, r) {
				(r === T || au(n[t], r)) && (r !== T || t in n) || st(n, t, r);
			}

			function ot(n, t, r) {
				var e = n[t];
				ii.call(n, t) && au(e, r) && (r !== T || t in n) || st(n, t, r)
			}

			function ft(n, t) {
				for (var r = n.length; r--;)
					if (au(n[r][0], t)) return r;
				return -1
			}

			function ct(n, t, r, e) {
				return eo(n, function (n, u, i) {
					t(e, n, r(n), i)
				}), e
			}

			function at(n, t) {
				return n && Cr(t, zu(t), n)
			}

			function lt(n, t) {
				return n && Cr(t, Wu(t), n)
			}

			function st(n, t, r) {
				"__proto__" == t && mi ? mi(n, t, {
					configurable: true,
					enumerable: true,
					value: r,
					writable: true
				}) : n[t] = r
			}

			function ht(n, t) {
				for (var r = -1, e = t.length, u = Vu(e), i = null == n; ++r < e;) u[r] = i ? T : Iu(n, t[r]);
				return u;
			}

			function pt(n, t, r) {
				return n === n && (r !== T && (n = n <= r ? n : r), t !== T && (n = n >= t ? n : t)), n
			}

			function _t(n, t, e, u, i, o) {
				var f, c = 1 & t,
					a = 2 & t,
					l = 4 & t;
				if (e && (f = i ? e(n, u, i, o) : e(n)), f !== T) return f;
				if (!gu(n)) return n;
				if (u = of (n)) {
					if (f = me(n), !c) return Ur(n, f)
				} else {
					var s = _o(n),
						h = "[object Function]" == s || "[object GeneratorFunction]" == s;
					if (cf(n)) return Ir(n, c);
					if ("[object Object]" == s || "[object Arguments]" == s || h && !i) {
						if (f = a || h ? {} : Ae(n), !c) return a ? Mr(n, lt(f, n)) : Dr(n, at(f, n))
					} else {
						if (!Ln[s]) return i ? n : {};
						f = ke(n, s, c)
					}
				}
				if (o || (o = new Pn), i = o.get(n)) return i;
				if (o.set(n, f), hf(n)) return n.forEach(function (r) {
					f.add(_t(r, t, e, r, n, o))
				}), f;
				if (lf(n)) return n.forEach(function (r, u) {
					f.set(u, _t(r, t, e, u, n, o))
				}), f;
				var a = l ? a ? ve : _e : a ? Wu : zu,
					p = u ? T : a(n);
				return r(p || n, function (r, u) {
					p && (u = r, r = n[u]), ot(f, u, _t(r, t, e, u, n, o))
				}), f
			}

			function vt(n) {
				var t = zu(n);
				return function (r) {
					return gt(r, n, t)
				}
			}

			function gt(n, t, r) {
				var e = r.length;
				if (null == n) return !e;
				for (n = Yu(n); e--;) {
					var u = r[e],
						i = t[u],
						o = n[u];
					if (o === T && !(u in n) || !i(o)) return false
				}
				return true
			}

			function dt(n, t, r) {
				if (typeof n != "function") throw new ni("Expected a function");
				return yo(function () {
					n.apply(T, r)
				}, t)
			}

			function yt(n, t, r, e) {
				var u = -1,
					i = o,
					a = true,
					l = n.length,
					s = [],
					h = t.length;
				if (!l) return s;
				r && (t = c(t, E(r))), e ? (i = f, a = false) : 200 <= t.length && (i = O, a = false, t = new Nn(t));
				n: for (; ++u < l;) {
					var p = n[u],
						_ = null == r ? p : r(p),
						p = e || 0 !== p ? p : 0;
					if (a && _ === _) {
						for (var v = h; v--;)
							if (t[v] === _) continue n;
						s.push(p)
					} else i(t, _, e) || s.push(p)
				}
				return s
			}

			function bt(n, t) {
				var r = true;
				return eo(n, function (n, e, u) {
					return r = !!t(n, e, u)
				}), r
			}

			function xt(n, t, r) {
				for (var e = -1, u = n.length; ++e < u;) {
					var i = n[e],
						o = t(i);
					if (null != o && (f === T ? o === o && !ju(o) : r(o, f))) var f = o,
						c = i;
				}
				return c
			}

			function jt(n, t) {
				var r = [];
				return eo(n, function (n, e, u) {
					t(n, e, u) && r.push(n)
				}), r
			}

			function wt(n, t, r, e, u) {
				var i = -1,
					o = n.length;
				for (r || (r = Ee), u || (u = []); ++i < o;) {
					var f = n[i];
					0 < t && r(f) ? 1 < t ? wt(f, t - 1, r, e, u) : a(u, f) : e || (u[u.length] = f)
				}
				return u
			}

			function mt(n, t) {
				return n && io(n, t, zu)
			}

			function At(n, t) {
				return n && oo(n, t, zu)
			}

			function kt(n, t) {
				return i(t, function (t) {
					return pu(n[t])
				})
			}

			function Et(n, t) {
				t = Sr(t, n);
				for (var r = 0, e = t.length; null != n && r < e;) n = n[De(t[r++])];
				return r && r == e ? n : T
			}

			function St(n, t, r) {
				return t = t(n), of (n) ? t : a(t, r(n))
			}

			function Ot(n) {
				if (null == n) n = n === T ? "[object Undefined]" : "[object Null]";
				else if (wi && wi in Yu(n)) {
					var t = ii.call(n, wi),
						r = n[wi];
					try {
						n[wi] = T;
						var e = true
					} catch (n) {}
					var u = ci.call(n);
					e && (t ? n[wi] = r : delete n[wi]), n = u
				} else n = ci.call(n);
				return n
			}

			function It(n, t) {
				return n > t
			}

			function Rt(n, t) {
				return null != n && ii.call(n, t)
			}

			function zt(n, t) {
				return null != n && t in Yu(n)
			}

			function Wt(n, t, r) {
				for (var e = r ? f : o, u = n[0].length, i = n.length, a = i, l = Vu(i), s = 1 / 0, h = []; a--;) {
					var p = n[a];
					a && t && (p = c(p, E(t))), s = Ui(p.length, s), l[a] = !r && (t || 120 <= u && 120 <= p.length) ? new Nn(a && p) : T
				}
				var p = n[0],
					_ = -1,
					v = l[0];
				n: for (; ++_ < u && h.length < s;) {
					var g = p[_],
						d = t ? t(g) : g,
						g = r || 0 !== g ? g : 0;
					if (v ? !O(v, d) : !e(h, d, r)) {
						for (a = i; --a;) {
							var y = l[a];
							if (y ? !O(y, d) : !e(n[a], d, r)) continue n
						}
						v && v.push(d), h.push(g)
					}
				}
				return h
			}

			function Bt(n, t, r) {
				var e = {};
				return mt(n, function (n, u, i) {
					t(e, r(n), u, i)
				}), e
			}

			function Lt(t, r, e) {
				return r = Sr(r, t), t = 2 > r.length ? t : Et(t, hr(r, 0, -1)), r = null == t ? t : t[De(qe(r))], null == r ? T : n(r, t, e)
			}

			function Ut(n) {
				return du(n) && "[object Arguments]" == Ot(n)
			}

			function Ct(n) {
				return du(n) && "[object ArrayBuffer]" == Ot(n)
			}

			function Dt(n) {
				return du(n) && "[object Date]" == Ot(n)
			}

			function Mt(n, t, r, e, u) {
				if (n === t) t = true;
				else if (null == n || null == t || !du(n) && !du(t)) t = n !== n && t !== t;
				else n: {
					var i = of (n),
						o = of (t),
						f = i ? "[object Array]" : _o(n),
						c = o ? "[object Array]" : _o(t),
						f = "[object Arguments]" == f ? "[object Object]" : f,
						c = "[object Arguments]" == c ? "[object Object]" : c,
						a = "[object Object]" == f,
						o = "[object Object]" == c;
					if ((c = f == c) && cf(n)) {
						if (!cf(t)) {
							t = false;
							break n
						}
						i = true, a = false
					}
					if (c && !a) u || (u = new Pn),
					t = i || pf(n) ? se(n, t, r, e, Mt, u) : he(n, t, f, r, e, Mt, u);
					else {
						if (!(1 & r) && (i = a && ii.call(n, "__wrapped__"), f = o && ii.call(t, "__wrapped__"), i || f)) {
							n = i ? n.value() : n, t = f ? t.value() : t, u || (u = new Pn), t = Mt(n, t, r, e, u);
							break n
						}
						if (c) t: if (u || (u = new Pn), i = 1 & r, f = _e(n), o = f.length, c = _e(t).length, o == c || i) {
								for (a = o; a--;) {
									var l = f[a];
									if (!(i ? l in t : ii.call(t, l))) {
										t = false;
										break t
									}
								}
								if ((c = u.get(n)) && u.get(t)) t = c == t;
								else {
									c = true, u.set(n, t), u.set(t, n);
									for (var s = i; ++a < o;) {
										var l = f[a],
											h = n[l],
											p = t[l];
										if (e) var _ = i ? e(p, h, l, t, n, u) : e(h, p, l, n, t, u);
										if (_ === T ? h !== p && !Mt(h, p, r, e, u) : !_) {
											c = false;
											break
										}
										s || (s = "constructor" == l);
									}
									c && !s && (r = n.constructor, e = t.constructor, r != e && "constructor" in n && "constructor" in t && !(typeof r == "function" && r instanceof r && typeof e == "function" && e instanceof e) && (c = false)), u.delete(n), u.delete(t), t = c
								}
							} else t = false;
						else t = false
					}
				}
				return t
			}

			function Tt(n) {
				return du(n) && "[object Map]" == _o(n)
			}

			function $t(n, t, r, e) {
				var u = r.length,
					i = u,
					o = !e;
				if (null == n) return !i;
				for (n = Yu(n); u--;) {
					var f = r[u];
					if (o && f[2] ? f[1] !== n[f[0]] : !(f[0] in n)) return false
				}
				for (; ++u < i;) {
					var f = r[u],
						c = f[0],
						a = n[c],
						l = f[1];
					if (o && f[2]) {
						if (a === T && !(c in n)) return false;
					} else {
						if (f = new Pn, e) var s = e(a, l, c, n, t, f);
						if (s === T ? !Mt(l, a, 3, e, f) : !s) return false
					}
				}
				return true
			}

			function Ft(n) {
				return !(!gu(n) || fi && fi in n) && (pu(n) ? si : dn).test(Me(n))
			}

			function Nt(n) {
				return du(n) && "[object RegExp]" == Ot(n)
			}

			function Pt(n) {
				return du(n) && "[object Set]" == _o(n)
			}

			function Zt(n) {
				return du(n) && vu(n.length) && !!Bn[Ot(n)]
			}

			function qt(n) {
				return typeof n == "function" ? n : null == n ? Tu : typeof n == "object" ? of (n) ? Jt(n[0], n[1]) : Ht(n) : Pu(n)
			}

			function Vt(n) {
				if (!ze(n)) return Bi(n);
				var t, r = [];
				for (t in Yu(n)) ii.call(n, t) && "constructor" != t && r.push(t);
				return r
			}

			function Kt(n, t) {
				return n < t
			}

			function Gt(n, t) {
				var r = -1,
					e = lu(n) ? Vu(n.length) : [];
				return eo(n, function (n, u, i) {
					e[++r] = t(n, u, i)
				}), e
			}

			function Ht(n) {
				var t = xe(n);
				return 1 == t.length && t[0][2] ? We(t[0][0], t[0][1]) : function (r) {
					return r === n || $t(r, n, t)
				}
			}

			function Jt(n, t) {
				return Ie(n) && t === t && !gu(t) ? We(De(n), t) : function (r) {
					var e = Iu(r, n);
					return e === T && e === t ? Ru(r, n) : Mt(t, e, 3)
				}
			}

			function Yt(n, t, r, e, u) {
				n !== t && io(t, function (i, o) {
					if (gu(i)) {
						u || (u = new Pn);
						var f = u,
							c = "__proto__" == o ? T : n[o],
							a = "__proto__" == o ? T : t[o],
							l = f.get(a);
						if (l) it(n, o, l);
						else {
							var l = e ? e(c, a, o + "", n, t, f) : T,
								s = l === T;
							if (s) {
								var h = of (a),
									p = !h && cf(a),
									_ = !h && !p && pf(a),
									l = a;
								h || p || _ ? of (c) ? l = c : su(c) ? l = Ur(c) : p ? (s = false, l = Ir(a, true)) : _ ? (s = false, l = zr(a, true)) : l = [] : bu(a) || uf(a) ? (l = c, uf(c) ? l = Su(c) : (!gu(c) || r && pu(c)) && (l = Ae(a))) : s = false
							}
							s && (f.set(a, l), Yt(l, a, r, e, f), f.delete(a)), it(n, o, l)
						}
					} else f = e ? e("__proto__" == o ? T : n[o], i, o + "", n, t, u) : T, f === T && (f = i), it(n, o, f)
				}, Wu)
			}

			function Qt(n, t) {
				var r = n.length;
				if (r) return t += 0 > t ? r : 0, Se(t, r) ? n[t] : T
			}

			function Xt(n, t, r) {
				var e = -1;
				return t = c(t.length ? t : [Tu], E(ye())), n = Gt(n, function (n) {
					return {
						a: c(t, function (t) {
							return t(n)
						}),
						b: ++e,
						c: n
					}
				}), w(n, function (n, t) {
					var e;
					n: {
						e = -1;
						for (var u = n.a, i = t.a, o = u.length, f = r.length; ++e < o;) {
							var c = Wr(u[e], i[e]);
							if (c) {
								e = e >= f ? c : c * ("desc" == r[e] ? -1 : 1);
								break n
							}
						}
						e = n.b - t.b
					}
					return e
				})
			}

			function nr(n, t) {
				return tr(n, t, function (t, r) {
					return Ru(n, r)
				})
			}

			function tr(n, t, r) {
				for (var e = -1, u = t.length, i = {}; ++e < u;) {
					var o = t[e],
						f = Et(n, o);
					r(f, o) && lr(i, Sr(o, n), f)
				}
				return i
			}

			function rr(n) {
				return function (t) {
					return Et(t, n)
				}
			}

			function er(n, t, r, e) {
				var u = e ? g : v,
					i = -1,
					o = t.length,
					f = n;
				for (n === t && (t = Ur(t)), r && (f = c(n, E(r))); ++i < o;)
					for (var a = 0, l = t[i], l = r ? r(l) : l; - 1 < (a = u(f, l, a, e));) f !== n && bi.call(f, a, 1), bi.call(n, a, 1);
				return n
			}

			function ur(n, t) {
				for (var r = n ? t.length : 0, e = r - 1; r--;) {
					var u = t[r];
					if (r == e || u !== i) {
						var i = u;
						Se(u) ? bi.call(n, u, 1) : xr(n, u)
					}
				}
			}

			function ir(n, t) {
				return n + Oi(Mi() * (t - n + 1))
			}

			function or(n, t) {
				var r = "";
				if (!n || 1 > t || 9007199254740991 < t) return r;
				do t % 2 && (r += n), (t = Oi(t / 2)) && (n += n); while (t);
				return r
			}

			function fr(n, t) {
				return bo(Be(n, t, Tu), n + "")
			}

			function cr(n) {
				return Qn(Lu(n))
			}

			function ar(n, t) {
				var r = Lu(n);
				return Ce(r, pt(t, 0, r.length))
			}

			function lr(n, t, r, e) {
				if (!gu(n)) return n;
				t = Sr(t, n);
				for (var u = -1, i = t.length, o = i - 1, f = n; null != f && ++u < i;) {
					var c = De(t[u]),
						a = r;
					if (u != o) {
						var l = f[c],
							a = e ? e(l, c, f) : T;
						a === T && (a = gu(l) ? l : Se(t[u + 1]) ? [] : {})
					}
					ot(f, c, a), f = f[c]
				}
				return n
			}

			function sr(n) {
				return Ce(Lu(n))
			}

			function hr(n, t, r) {
				var e = -1,
					u = n.length;
				for (0 > t && (t = -t > u ? 0 : u + t), r = r > u ? u : r, 0 > r && (r += u), u = t > r ? 0 : r - t >>> 0, t >>>= 0, r = Vu(u); ++e < u;) r[e] = n[e + t];
				return r
			}

			function pr(n, t) {
				var r;
				return eo(n, function (n, e, u) {
					return r = t(n, e, u), !r
				}), !!r
			}

			function _r(n, t, r) {
				var e = 0,
					u = null == n ? e : n.length;
				if (typeof t == "number" && t === t && 2147483647 >= u) {
					for (; e < u;) {
						var i = e + u >>> 1,
							o = n[i];
						null !== o && !ju(o) && (r ? o <= t : o < t) ? e = i + 1 : u = i
					}
					return u
				}
				return vr(n, t, Tu, r)
			}

			function vr(n, t, r, e) {
				t = r(t);
				for (var u = 0, i = null == n ? 0 : n.length, o = t !== t, f = null === t, c = ju(t), a = t === T; u < i;) {
					var l = Oi((u + i) / 2),
						s = r(n[l]),
						h = s !== T,
						p = null === s,
						_ = s === s,
						v = ju(s);
					(o ? e || _ : a ? _ && (e || h) : f ? _ && h && (e || !p) : c ? _ && h && !p && (e || !v) : p || v ? 0 : e ? s <= t : s < t) ? u = l + 1: i = l
				}
				return Ui(i, 4294967294)
			}

			function gr(n, t) {
				for (var r = -1, e = n.length, u = 0, i = []; ++r < e;) {
					var o = n[r],
						f = t ? t(o) : o;
					if (!r || !au(f, c)) {
						var c = f;
						i[u++] = 0 === o ? 0 : o
					}
				}
				return i
			}

			function dr(n) {
				return typeof n == "number" ? n : ju(n) ? F : +n
			}

			function yr(n) {
				if (typeof n == "string") return n;
				if ( of (n)) return c(n, yr) + "";
				if (ju(n)) return to ? to.call(n) : "";
				var t = n + "";
				return "0" == t && 1 / n == -$ ? "-0" : t
			}

			function br(n, t, r) {
				var e = -1,
					u = o,
					i = n.length,
					c = true,
					a = [],
					l = a;
				if (r) c = false, u = f;
				else if (200 <= i) {
					if (u = t ? null : lo(n)) return U(u);
					c = false, u = O, l = new Nn
				} else l = t ? [] : a;
				n: for (; ++e < i;) {
					var s = n[e],
						h = t ? t(s) : s,
						s = r || 0 !== s ? s : 0;
					if (c && h === h) {
						for (var p = l.length; p--;)
							if (l[p] === h) continue n;
						t && l.push(h), a.push(s)
					} else u(l, h, r) || (l !== a && l.push(h), a.push(s))
				}
				return a
			}

			function xr(n, t) {
				return t = Sr(t, n), n = 2 > t.length ? n : Et(n, hr(t, 0, -1)), null == n || delete n[De(qe(t))]
			}

			function jr(n, t, r, e) {
				for (var u = n.length, i = e ? u : -1;
					(e ? i-- : ++i < u) && t(n[i], i, n););
				return r ? hr(n, e ? 0 : i, e ? i + 1 : u) : hr(n, e ? i + 1 : 0, e ? u : i)
			}

			function wr(n, t) {
				var r = n;
				return r instanceof Un && (r = r.value()), l(t, function (n, t) {
					return t.func.apply(t.thisArg, a([n], t.args))
				}, r)
			}

			function mr(n, t, r) {
				var e = n.length;
				if (2 > e) return e ? br(n[0]) : [];
				for (var u = -1, i = Vu(e); ++u < e;)
					for (var o = n[u], f = -1; ++f < e;) f != u && (i[u] = yt(i[u] || o, n[f], t, r));
				return br(wt(i, 1), t, r)
			}

			function Ar(n, t, r) {
				for (var e = -1, u = n.length, i = t.length, o = {}; ++e < u;) r(o, n[e], e < i ? t[e] : T);
				return o
			}

			function kr(n) {
				return su(n) ? n : []
			}

			function Er(n) {
				return typeof n == "function" ? n : Tu
			}

			function Sr(n, t) {
				return of(n) ? n : Ie(n, t) ? [n] : xo(Ou(n))
			}

			function Or(n, t, r) {
				var e = n.length;
				return r = r === T ? e : r, !t && r >= e ? n : hr(n, t, r)
			}

			function Ir(n, t) {
				if (t) return n.slice();
				var r = n.length,
					r = vi ? vi(r) : new n.constructor(r);
				return n.copy(r), r
			}

			function Rr(n) {
				var t = new n.constructor(n.byteLength);
				return new _i(t).set(new _i(n)), t
			}

			function zr(n, t) {
				return new n.constructor(t ? Rr(n.buffer) : n.buffer, n.byteOffset, n.length)
			}

			function Wr(n, t) {
				if (n !== t) {
					var r = n !== T,
						e = null === n,
						u = n === n,
						i = ju(n),
						o = t !== T,
						f = null === t,
						c = t === t,
						a = ju(t);
					if (!f && !a && !i && n > t || i && o && c && !f && !a || e && o && c || !r && c || !u) return 1;
					if (!e && !i && !a && n < t || a && r && u && !e && !i || f && r && u || !o && u || !c) return -1
				}
				return 0
			}

			function Br(n, t, r, e) {
				var u = -1,
					i = n.length,
					o = r.length,
					f = -1,
					c = t.length,
					a = Li(i - o, 0),
					l = Vu(c + a);
				for (e = !e; ++f < c;) l[f] = t[f];
				for (; ++u < o;)(e || u < i) && (l[r[u]] = n[u]);
				for (; a--;) l[f++] = n[u++];
				return l
			}

			function Lr(n, t, r, e) {
				var u = -1,
					i = n.length,
					o = -1,
					f = r.length,
					c = -1,
					a = t.length,
					l = Li(i - f, 0),
					s = Vu(l + a);
				for (e = !e; ++u < l;) s[u] = n[u];
				for (l = u; ++c < a;) s[l + c] = t[c];
				for (; ++o < f;)(e || u < i) && (s[l + r[o]] = n[u++]);
				return s
			}

			function Ur(n, t) {
				var r = -1,
					e = n.length;
				for (t || (t = Vu(e)); ++r < e;) t[r] = n[r];
				return t
			}

			function Cr(n, t, r, e) {
				var u = !r;
				r || (r = {});
				for (var i = -1, o = t.length; ++i < o;) {
					var f = t[i],
						c = e ? e(r[f], n[f], f, r, n) : T;
					c === T && (c = n[f]), u ? st(r, f, c) : ot(r, f, c)
				}
				return r
			}

			function Dr(n, t) {
				return Cr(n, ho(n), t)
			}

			function Mr(n, t) {
				return Cr(n, po(n), t);
			}

			function Tr(n, r) {
				return function (e, u) {
					var i = of (e) ? t : ct,
						o = r ? r() : {};
					return i(e, n, ye(u, 2), o)
				}
			}

			function $r(n) {
				return fr(function (t, r) {
					var e = -1,
						u = r.length,
						i = 1 < u ? r[u - 1] : T,
						o = 2 < u ? r[2] : T,
						i = 3 < n.length && typeof i == "function" ? (u--, i) : T;
					for (o && Oe(r[0], r[1], o) && (i = 3 > u ? T : i, u = 1), t = Yu(t); ++e < u;)(o = r[e]) && n(t, o, e, i);
					return t
				})
			}

			function Fr(n, t) {
				return function (r, e) {
					if (null == r) return r;
					if (!lu(r)) return n(r, e);
					for (var u = r.length, i = t ? u : -1, o = Yu(r);
						(t ? i-- : ++i < u) && false !== e(o[i], i, o););
					return r
				}
			}

			function Nr(n) {
				return function (t, r, e) {
					var u = -1,
						i = Yu(t);
					e = e(t);
					for (var o = e.length; o--;) {
						var f = e[n ? o : ++u];
						if (false === r(i[f], f, i)) break
					}
					return t
				}
			}

			function Pr(n, t, r) {
				function e() {
					return (this && this !== Fn && this instanceof e ? i : n).apply(u ? r : this, arguments)
				}
				var u = 1 & t,
					i = Vr(n);
				return e
			}

			function Zr(n) {
				return function (t) {
					t = Ou(t);
					var r = Rn.test(t) ? M(t) : T,
						e = r ? r[0] : t.charAt(0);
					return t = r ? Or(r, 1).join("") : t.slice(1), e[n]() + t
				}
			}

			function qr(n) {
				return function (t) {
					return l(Du(Cu(t).replace(En, "")), n, "")
				}
			}

			function Vr(n) {
				return function () {
					var t = arguments;
					switch (t.length) {
						case 0:
							return new n;
						case 1:
							return new n(t[0]);
						case 2:
							return new n(t[0], t[1]);
						case 3:
							return new n(t[0], t[1], t[2]);
						case 4:
							return new n(t[0], t[1], t[2], t[3]);
						case 5:
							return new n(t[0], t[1], t[2], t[3], t[4]);
						case 6:
							return new n(t[0], t[1], t[2], t[3], t[4], t[5]);
						case 7:
							return new n(t[0], t[1], t[2], t[3], t[4], t[5], t[6])
					}
					var r = ro(n.prototype),
						t = n.apply(r, t);
					return gu(t) ? t : r
				}
			}

			function Kr(t, r, e) {
				function u() {
					for (var o = arguments.length, f = Vu(o), c = o, a = de(u); c--;) f[c] = arguments[c];
					return c = 3 > o && f[0] !== a && f[o - 1] !== a ? [] : L(f, a), o -= c.length, o < e ? ue(t, r, Jr, u.placeholder, T, f, c, T, T, e - o) : n(this && this !== Fn && this instanceof u ? i : t, this, f)
				}
				var i = Vr(t);
				return u
			}

			function Gr(n) {
				return function (t, r, e) {
					var u = Yu(t);
					if (!lu(t)) {
						var i = ye(r, 3);
						t = zu(t), r = function (n) {
							return i(u[n], n, u)
						}
					}
					return r = n(t, r, e), -1 < r ? u[i ? t[r] : r] : T
				}
			}

			function Hr(n) {
				return pe(function (t) {
					var r = t.length,
						e = r,
						u = On.prototype.thru;
					for (n && t.reverse(); e--;) {
						var i = t[e];
						if (typeof i != "function") throw new ni("Expected a function");
						if (u && !o && "wrapper" == ge(i)) var o = new On([], true)
					}
					for (e = o ? e : r; ++e < r;) var i = t[e],
						u = ge(i),
						f = "wrapper" == u ? so(i) : T,
						o = f && Re(f[0]) && 424 == f[1] && !f[4].length && 1 == f[9] ? o[ge(f[0])].apply(o, f[3]) : 1 == i.length && Re(i) ? o[u]() : o.thru(i);
					return function () {
						var n = arguments,
							e = n[0];
						if (o && 1 == n.length && of (e)) return o.plant(e).value();
						for (var u = 0, n = r ? t[u].apply(this, n) : e; ++u < r;) n = t[u].call(this, n);
						return n
					}
				})
			}

			function Jr(n, t, r, e, u, i, o, f, c, a) {
				function l() {
					for (var d = arguments.length, y = Vu(d), b = d; b--;) y[b] = arguments[b];
					if (_) {
						var x, j = de(l),
							b = y.length;
						for (x = 0; b--;) y[b] === j && ++x
					}
					if (e && (y = Br(y, e, u, _)), i && (y = Lr(y, i, o, _)), d -= x, _ && d < a) return j = L(y, j), ue(n, t, Jr, l.placeholder, r, y, j, f, c, a - d);
					if (j = h ? r : this, b = p ? j[n] : n, d = y.length, f) {
						x = y.length;
						for (var w = Ui(f.length, x), m = Ur(y); w--;) {
							var A = f[w];
							y[w] = Se(A, x) ? m[A] : T
						}
					} else v && 1 < d && y.reverse();
					return s && c < d && (y.length = c), this && this !== Fn && this instanceof l && (b = g || Vr(b)), b.apply(j, y)
				}
				var s = 128 & t,
					h = 1 & t,
					p = 2 & t,
					_ = 24 & t,
					v = 512 & t,
					g = p ? T : Vr(n);
				return l
			}

			function Yr(n, t) {
				return function (r, e) {
					return Bt(r, n, t(e))
				}
			}

			function Qr(n, t) {
				return function (r, e) {
					var u;
					if (r === T && e === T) return t;
					if (r !== T && (u = r), e !== T) {
						if (u === T) return e;
						typeof r == "string" || typeof e == "string" ? (r = yr(r), e = yr(e)) : (r = dr(r), e = dr(e)), u = n(r, e)
					}
					return u
				}
			}

			function Xr(t) {
				return pe(function (r) {
					return r = c(r, E(ye())), fr(function (e) {
						var u = this;
						return t(r, function (t) {
							return n(t, u, e)
						})
					})
				})
			}

			function ne(n, t) {
				t = t === T ? " " : yr(t);
				var r = t.length;
				return 2 > r ? r ? or(t, n) : t : (r = or(t, Si(n / D(t))), Rn.test(t) ? Or(M(r), 0, n).join("") : r.slice(0, n))
			}

			function te(t, r, e, u) {
				function i() {
					for (var r = -1, c = arguments.length, a = -1, l = u.length, s = Vu(l + c), h = this && this !== Fn && this instanceof i ? f : t; ++a < l;) s[a] = u[a];
					for (; c--;) s[a++] = arguments[++r];
					return n(h, o ? e : this, s)
				}
				var o = 1 & r,
					f = Vr(t);
				return i
			}

			function re(n) {
				return function (t, r, e) {
					e && typeof e != "number" && Oe(t, r, e) && (r = e = T), t = mu(t), r === T ? (r = t, t = 0) : r = mu(r), e = e === T ? t < r ? 1 : -1 : mu(e);
					var u = -1;
					r = Li(Si((r - t) / (e || 1)), 0);
					for (var i = Vu(r); r--;) i[n ? r : ++u] = t, t += e;
					return i
				}
			}

			function ee(n) {
				return function (t, r) {
					return typeof t == "string" && typeof r == "string" || (t = Eu(t), r = Eu(r)), n(t, r)
				}
			}

			function ue(n, t, r, e, u, i, o, f, c, a) {
				var l = 8 & t,
					s = l ? o : T;
				o = l ? T : o;
				var h = l ? i : T;
				return i = l ? T : i, t = (t | (l ? 32 : 64)) & ~(l ? 64 : 32), 4 & t || (t &= -4), u = [n, t, u, h, s, i, o, f, c, a], r = r.apply(T, u), Re(n) && go(r, u), r.placeholder = e, Le(r, n, t)
			}

			function ie(n) {
				var t = Ju[n];
				return function (n, r) {
					if (n = Eu(n), r = null == r ? 0 : Ui(Au(r), 292)) {
						var e = (Ou(n) + "e").split("e"),
							e = t(e[0] + "e" + (+e[1] + r)),
							e = (Ou(e) + "e").split("e");
						return +(e[0] + "e" + (+e[1] - r))
					}
					return t(n)
				}
			}

			function oe(n) {
				return function (t) {
					var r = _o(t);
					return "[object Map]" == r ? W(t) : "[object Set]" == r ? C(t) : k(t, n(t))
				}
			}

			function fe(n, t, r, e, u, i, o, f) {
				var c = 2 & t;
				if (!c && typeof n != "function") throw new ni("Expected a function");
				var a = e ? e.length : 0;
				if (a || (t &= -97, e = u = T), o = o === T ? o : Li(Au(o), 0), f = f === T ? f : Au(f), a -= u ? u.length : 0, 64 & t) {
					var l = e,
						s = u;
					e = u = T
				}
				var h = c ? T : so(n);
				return i = [n, t, r, e, u, l, s, i, o, f], h && (r = i[1], n = h[1], t = r | n, e = 128 == n && 8 == r || 128 == n && 256 == r && i[7].length <= h[8] || 384 == n && h[7].length <= h[8] && 8 == r, 131 > t || e) && (1 & n && (i[2] = h[2], t |= 1 & r ? 0 : 4), (r = h[3]) && (e = i[3], i[3] = e ? Br(e, r, h[4]) : r, i[4] = e ? L(i[3], "__lodash_placeholder__") : h[4]), (r = h[5]) && (e = i[5], i[5] = e ? Lr(e, r, h[6]) : r, i[6] = e ? L(i[5], "__lodash_placeholder__") : h[6]), (r = h[7]) && (i[7] = r), 128 & n && (i[8] = null == i[8] ? h[8] : Ui(i[8], h[8])), null == i[9] && (i[9] = h[9]), i[0] = h[0], i[1] = t), n = i[0], t = i[1], r = i[2], e = i[3], u = i[4], f = i[9] = i[9] === T ? c ? 0 : n.length : Li(i[9] - a, 0), !f && 24 & t && (t &= -25), Le((h ? fo : go)(t && 1 != t ? 8 == t || 16 == t ? Kr(n, t, f) : 32 != t && 33 != t || u.length ? Jr.apply(T, i) : te(n, t, r, e) : Pr(n, t, r), i), n, t)
			}

			function ce(n, t, r, e) {
				return n === T || au(n, ri[r]) && !ii.call(e, r) ? t : n
			}

			function ae(n, t, r, e, u, i) {
				return gu(n) && gu(t) && (i.set(t, n), Yt(n, t, T, ae, i), i.delete(t)), n
			}

			function le(n) {
				return bu(n) ? T : n
			}

			function se(n, t, r, e, u, i) {
				var o = 1 & r,
					f = n.length,
					c = t.length;
				if (f != c && !(o && c > f)) return false;
				if ((c = i.get(n)) && i.get(t)) return c == t;
				var c = -1,
					a = true,
					l = 2 & r ? new Nn : T;
				for (i.set(n, t), i.set(t, n); ++c < f;) {
					var s = n[c],
						p = t[c];
					if (e) var _ = o ? e(p, s, c, t, n, i) : e(s, p, c, n, t, i);
					if (_ !== T) {
						if (_) continue;
						a = false;
						break
					}
					if (l) {
						if (!h(t, function (n, t) {
								if (!O(l, t) && (s === n || u(s, n, r, e, i))) return l.push(t)
							})) {
							a = false;
							break
						}
					} else if (s !== p && !u(s, p, r, e, i)) {
						a = false;
						break
					}
				}
				return i.delete(n), i.delete(t), a
			}

			function he(n, t, r, e, u, i, o) {
				switch (r) {
					case "[object DataView]":
						if (n.byteLength != t.byteLength || n.byteOffset != t.byteOffset) break;
						n = n.buffer, t = t.buffer;
					case "[object ArrayBuffer]":
						if (n.byteLength != t.byteLength || !i(new _i(n), new _i(t))) break;
						return true;
					case "[object Boolean]":
					case "[object Date]":
					case "[object Number]":
						return au(+n, +t);
					case "[object Error]":
						return n.name == t.name && n.message == t.message;
					case "[object RegExp]":
					case "[object String]":
						return n == t + "";
					case "[object Map]":
						var f = W;
					case "[object Set]":
						if (f || (f = U), n.size != t.size && !(1 & e)) break;
						return (r = o.get(n)) ? r == t : (e |= 2, o.set(n, t), t = se(f(n), f(t), e, u, i, o), o.delete(n), t);
					case "[object Symbol]":
						if (no) return no.call(n) == no.call(t)
				}
				return false
			}

			function pe(n) {
				return bo(Be(n, T, Pe), n + "")
			}

			function _e(n) {
				return St(n, zu, ho)
			}

			function ve(n) {
				return St(n, Wu, po)
			}

			function ge(n) {
				for (var t = n.name + "", r = Ki[t], e = ii.call(Ki, t) ? r.length : 0; e--;) {
					var u = r[e],
						i = u.func;
					if (null == i || i == n) return u.name
				}
				return t
			}

			function de(n) {
				return (ii.call(An, "placeholder") ? An : n).placeholder
			}

			function ye() {
				var n = An.iteratee || $u,
					n = n === $u ? qt : n;
				return arguments.length ? n(arguments[0], arguments[1]) : n
			}

			function be(n, t) {
				var r = n.__data__,
					e = typeof t;
				return ("string" == e || "number" == e || "symbol" == e || "boolean" == e ? "__proto__" !== t : null === t) ? r[typeof t == "string" ? "string" : "hash"] : r.map;
			}

			function xe(n) {
				for (var t = zu(n), r = t.length; r--;) {
					var e = t[r],
						u = n[e];
					t[r] = [e, u, u === u && !gu(u)]
				}
				return t
			}

			function je(n, t) {
				var r = null == n ? T : n[t];
				return Ft(r) ? r : T
			}

			function we(n, t, r) {
				t = Sr(t, n);
				for (var e = -1, u = t.length, i = false; ++e < u;) {
					var o = De(t[e]);
					if (!(i = null != n && r(n, o))) break;
					n = n[o]
				}
				return i || ++e != u ? i : (u = null == n ? 0 : n.length, !!u && vu(u) && Se(o, u) && ( of (n) || uf(n)))
			}

			function me(n) {
				var t = n.length,
					r = new n.constructor(t);
				return t && "string" == typeof n[0] && ii.call(n, "index") && (r.index = n.index, r.input = n.input), r
			}

			function Ae(n) {
				return typeof n.constructor != "function" || ze(n) ? {} : ro(gi(n))
			}

			function ke(n, t, r) {
				var e = n.constructor;
				switch (t) {
					case "[object ArrayBuffer]":
						return Rr(n);
					case "[object Boolean]":
					case "[object Date]":
						return new e(+n);
					case "[object DataView]":
						return t = r ? Rr(n.buffer) : n.buffer, new n.constructor(t, n.byteOffset, n.byteLength);
					case "[object Float32Array]":
					case "[object Float64Array]":
					case "[object Int8Array]":
					case "[object Int16Array]":
					case "[object Int32Array]":
					case "[object Uint8Array]":
					case "[object Uint8ClampedArray]":
					case "[object Uint16Array]":
					case "[object Uint32Array]":
						return zr(n, r);
					case "[object Map]":
						return new e;
					case "[object Number]":
					case "[object String]":
						return new e(n);
					case "[object RegExp]":
						return t = new n.constructor(n.source, _n.exec(n)), t.lastIndex = n.lastIndex, t;
					case "[object Set]":
						return new e;
					case "[object Symbol]":
						return no ? Yu(no.call(n)) : {}
				}
			}

			function Ee(n) {
				return of(n) || uf(n) || !!(xi && n && n[xi])
			}

			function Se(n, t) {
				var r = typeof n;
				return t = null == t ? 9007199254740991 : t, !!t && ("number" == r || "symbol" != r && bn.test(n)) && -1 < n && 0 == n % 1 && n < t;
			}

			function Oe(n, t, r) {
				if (!gu(r)) return false;
				var e = typeof t;
				return !!("number" == e ? lu(r) && Se(t, r.length) : "string" == e && t in r) && au(r[t], n)
			}

			function Ie(n, t) {
				if ( of (n)) return false;
				var r = typeof n;
				return !("number" != r && "symbol" != r && "boolean" != r && null != n && !ju(n)) || (nn.test(n) || !X.test(n) || null != t && n in Yu(t))
			}

			function Re(n) {
				var t = ge(n),
					r = An[t];
				return typeof r == "function" && t in Un.prototype && (n === r || (t = so(r), !!t && n === t[0]))
			}

			function ze(n) {
				var t = n && n.constructor;
				return n === (typeof t == "function" && t.prototype || ri)
			}

			function We(n, t) {
				return function (r) {
					return null != r && (r[n] === t && (t !== T || n in Yu(r)))
				}
			}

			function Be(t, r, e) {
				return r = Li(r === T ? t.length - 1 : r, 0),
					function () {
						for (var u = arguments, i = -1, o = Li(u.length - r, 0), f = Vu(o); ++i < o;) f[i] = u[r + i];
						for (i = -1, o = Vu(r + 1); ++i < r;) o[i] = u[i];
						return o[r] = e(f), n(t, this, o)
					}
			}

			function Le(n, t, r) {
				var e = t + "";
				t = bo;
				var u, i = Te;
				return u = (u = e.match(an)) ? u[1].split(ln) : [], r = i(u, r), (i = r.length) && (u = i - 1, r[u] = (1 < i ? "& " : "") + r[u], r = r.join(2 < i ? ", " : " "), e = e.replace(cn, "{\n/* [wrapped with " + r + "] */\n")), t(n, e)
			}

			function Ue(n) {
				var t = 0,
					r = 0;
				return function () {
					var e = Ci(),
						u = 16 - (e - r);
					if (r = e, 0 < u) {
						if (800 <= ++t) return arguments[0]
					} else t = 0;
					return n.apply(T, arguments)
				}
			}

			function Ce(n, t) {
				var r = -1,
					e = n.length,
					u = e - 1;
				for (t = t === T ? e : t; ++r < t;) {
					var e = ir(r, u),
						i = n[e];
					n[e] = n[r], n[r] = i
				}
				return n.length = t, n
			}

			function De(n) {
				if (typeof n == "string" || ju(n)) return n;
				var t = n + "";
				return "0" == t && 1 / n == -$ ? "-0" : t
			}

			function Me(n) {
				if (null != n) {
					try {
						return ui.call(n)
					} catch (n) {}
					return n + ""
				}
				return ""
			}

			function Te(n, t) {
				return r(N, function (r) {
					var e = "_." + r[0];
					t & r[1] && !o(n, e) && n.push(e);
				}), n.sort()
			}

			function $e(n) {
				if (n instanceof Un) return n.clone();
				var t = new On(n.__wrapped__, n.__chain__);
				return t.__actions__ = Ur(n.__actions__), t.__index__ = n.__index__, t.__values__ = n.__values__, t
			}

			function Fe(n, t, r) {
				var e = null == n ? 0 : n.length;
				return e ? (r = null == r ? 0 : Au(r), 0 > r && (r = Li(e + r, 0)), _(n, ye(t, 3), r)) : -1
			}

			function Ne(n, t, r) {
				var e = null == n ? 0 : n.length;
				if (!e) return -1;
				var u = e - 1;
				return r !== T && (u = Au(r), u = 0 > r ? Li(e + u, 0) : Ui(u, e - 1)), _(n, ye(t, 3), u, true)
			}

			function Pe(n) {
				return (null == n ? 0 : n.length) ? wt(n, 1) : []
			}

			function Ze(n) {
				return n && n.length ? n[0] : T
			}

			function qe(n) {
				var t = null == n ? 0 : n.length;
				return t ? n[t - 1] : T
			}

			function Ve(n, t) {
				return n && n.length && t && t.length ? er(n, t) : n
			}

			function Ke(n) {
				return null == n ? n : Ti.call(n)
			}

			function Ge(n) {
				if (!n || !n.length) return [];
				var t = 0;
				return n = i(n, function (n) {
					if (su(n)) return t = Li(n.length, t), true
				}), A(t, function (t) {
					return c(n, b(t))
				})
			}

			function He(t, r) {
				if (!t || !t.length) return [];
				var e = Ge(t);
				return null == r ? e : c(e, function (t) {
					return n(r, T, t)
				})
			}

			function Je(n) {
				return n = An(n), n.__chain__ = true, n
			}

			function Ye(n, t) {
				return t(n)
			}

			function Qe() {
				return this
			}

			function Xe(n, t) {
				return ( of (n) ? r : eo)(n, ye(t, 3))
			}

			function nu(n, t) {
				return ( of (n) ? e : uo)(n, ye(t, 3))
			}

			function tu(n, t) {
				return ( of (n) ? c : Gt)(n, ye(t, 3))
			}

			function ru(n, t, r) {
				return t = r ? T : t, t = n && null == t ? n.length : t, fe(n, 128, T, T, T, T, t)
			}

			function eu(n, t) {
				var r;
				if (typeof t != "function") throw new ni("Expected a function");
				return n = Au(n),
					function () {
						return 0 < --n && (r = t.apply(this, arguments)), 1 >= n && (t = T), r
					}
			}

			function uu(n, t, r) {
				return t = r ? T : t, n = fe(n, 8, T, T, T, T, T, t), n.placeholder = uu.placeholder, n
			}

			function iu(n, t, r) {
				return t = r ? T : t, n = fe(n, 16, T, T, T, T, T, t), n.placeholder = iu.placeholder, n
			}

			function ou(n, t, r) {
				function e(t) {
					var r = c,
						e = a;
					return c = a = T, _ = t, s = n.apply(e, r)
				}

				function u(n) {
					var r = n - p;
					return n -= _, p === T || r >= t || 0 > r || g && n >= l
				}

				function i() {
					var n = Ko();
					if (u(n)) return o(n);
					var r, e = yo;
					r = n - _, n = t - (n - p), r = g ? Ui(n, l - r) : n, h = e(i, r)
				}

				function o(n) {
					return h = T, d && c ? e(n) : (c = a = T, s)
				}

				function f() {
					var n = Ko(),
						r = u(n);
					if (c = arguments, a = this, p = n, r) {
						if (h === T) return _ = n = p, h = yo(i, t), v ? e(n) : s;
						if (g) return h = yo(i, t), e(p)
					}
					return h === T && (h = yo(i, t)), s
				}
				var c, a, l, s, h, p, _ = 0,
					v = false,
					g = false,
					d = true;
				if (typeof n != "function") throw new ni("Expected a function");
				return t = Eu(t) || 0, gu(r) && (v = !!r.leading, l = (g = "maxWait" in r) ? Li(Eu(r.maxWait) || 0, t) : l, d = "trailing" in r ? !!r.trailing : d), f.cancel = function () {
					h !== T && ao(h), _ = 0, c = p = a = h = T
				}, f.flush = function () {
					return h === T ? s : o(Ko())
				}, f
			}

			function fu(n, t) {
				function r() {
					var e = arguments,
						u = t ? t.apply(this, e) : e[0],
						i = r.cache;
					return i.has(u) ? i.get(u) : (e = n.apply(this, e), r.cache = i.set(u, e) || i, e)
				}
				if (typeof n != "function" || null != t && typeof t != "function") throw new ni("Expected a function");
				return r.cache = new(fu.Cache || $n), r
			}

			function cu(n) {
				if (typeof n != "function") throw new ni("Expected a function");
				return function () {
					var t = arguments;
					switch (t.length) {
						case 0:
							return !n.call(this);
						case 1:
							return !n.call(this, t[0]);
						case 2:
							return !n.call(this, t[0], t[1]);
						case 3:
							return !n.call(this, t[0], t[1], t[2])
					}
					return !n.apply(this, t)
				}
			}

			function au(n, t) {
				return n === t || n !== n && t !== t
			}

			function lu(n) {
				return null != n && vu(n.length) && !pu(n)
			}

			function su(n) {
				return du(n) && lu(n)
			}

			function hu(n) {
				if (!du(n)) return false;
				var t = Ot(n);
				return "[object Error]" == t || "[object DOMException]" == t || typeof n.message == "string" && typeof n.name == "string" && !bu(n);
			}

			function pu(n) {
				return !!gu(n) && (n = Ot(n), "[object Function]" == n || "[object GeneratorFunction]" == n || "[object AsyncFunction]" == n || "[object Proxy]" == n)
			}

			function _u(n) {
				return typeof n == "number" && n == Au(n)
			}

			function vu(n) {
				return typeof n == "number" && -1 < n && 0 == n % 1 && 9007199254740991 >= n
			}

			function gu(n) {
				var t = typeof n;
				return null != n && ("object" == t || "function" == t)
			}

			function du(n) {
				return null != n && typeof n == "object"
			}

			function yu(n) {
				return typeof n == "number" || du(n) && "[object Number]" == Ot(n)
			}

			function bu(n) {
				return !(!du(n) || "[object Object]" != Ot(n)) && (n = gi(n), null === n || (n = ii.call(n, "constructor") && n.constructor, typeof n == "function" && n instanceof n && ui.call(n) == ai))
			}

			function xu(n) {
				return typeof n == "string" || ! of (n) && du(n) && "[object String]" == Ot(n)
			}

			function ju(n) {
				return typeof n == "symbol" || du(n) && "[object Symbol]" == Ot(n)
			}

			function wu(n) {
				if (!n) return [];
				if (lu(n)) return xu(n) ? M(n) : Ur(n);
				if (ji && n[ji]) {
					n = n[ji]();
					for (var t, r = []; !(t = n.next()).done;) r.push(t.value);
					return r
				}
				return t = _o(n), ("[object Map]" == t ? W : "[object Set]" == t ? U : Lu)(n)
			}

			function mu(n) {
				return n ? (n = Eu(n), n === $ || n === -$ ? 1.7976931348623157e308 * (0 > n ? -1 : 1) : n === n ? n : 0) : 0 === n ? n : 0
			}

			function Au(n) {
				n = mu(n);
				var t = n % 1;
				return n === n ? t ? n - t : n : 0
			}

			function ku(n) {
				return n ? pt(Au(n), 0, 4294967295) : 0
			}

			function Eu(n) {
				if (typeof n == "number") return n;
				if (ju(n)) return F;
				if (gu(n) && (n = typeof n.valueOf == "function" ? n.valueOf() : n, n = gu(n) ? n + "" : n), typeof n != "string") return 0 === n ? n : +n;
				n = n.replace(un, "");
				var t = gn.test(n);
				return t || yn.test(n) ? Mn(n.slice(2), t ? 2 : 8) : vn.test(n) ? F : +n
			}

			function Su(n) {
				return Cr(n, Wu(n))
			}

			function Ou(n) {
				return null == n ? "" : yr(n);
			}

			function Iu(n, t, r) {
				return n = null == n ? T : Et(n, t), n === T ? r : n
			}

			function Ru(n, t) {
				return null != n && we(n, t, zt)
			}

			function zu(n) {
				return lu(n) ? qn(n) : Vt(n)
			}

			function Wu(n) {
				if (lu(n)) n = qn(n, true);
				else if (gu(n)) {
					var t, r = ze(n),
						e = [];
					for (t in n)("constructor" != t || !r && ii.call(n, t)) && e.push(t);
					n = e
				} else {
					if (t = [], null != n)
						for (r in Yu(n)) t.push(r);
					n = t
				}
				return n
			}

			function Bu(n, t) {
				if (null == n) return {};
				var r = c(ve(n), function (n) {
					return [n]
				});
				return t = ye(t), tr(n, r, function (n, r) {
					return t(n, r[0])
				})
			}

			function Lu(n) {
				return null == n ? [] : S(n, zu(n));
			}

			function Uu(n) {
				return Tf(Ou(n).toLowerCase())
			}

			function Cu(n) {
				return (n = Ou(n)) && n.replace(xn, Xn).replace(Sn, "")
			}

			function Du(n, t, r) {
				return n = Ou(n), t = r ? T : t, t === T ? zn.test(n) ? n.match(In) || [] : n.match(sn) || [] : n.match(t) || []
			}

			function Mu(n) {
				return function () {
					return n
				}
			}

			function Tu(n) {
				return n
			}

			function $u(n) {
				return qt(typeof n == "function" ? n : _t(n, 1))
			}

			function Fu(n, t, e) {
				var u = zu(t),
					i = kt(t, u);
				null != e || gu(t) && (i.length || !u.length) || (e = t, t = n, n = this, i = kt(t, zu(t)));
				var o = !(gu(e) && "chain" in e && !e.chain),
					f = pu(n);
				return r(i, function (r) {
					var e = t[r];
					n[r] = e, f && (n.prototype[r] = function () {
						var t = this.__chain__;
						if (o || t) {
							var r = n(this.__wrapped__);
							return (r.__actions__ = Ur(this.__actions__)).push({
								func: e,
								args: arguments,
								thisArg: n
							}), r.__chain__ = t, r
						}
						return e.apply(n, a([this.value()], arguments))
					})
				}), n
			}

			function Nu() {}

			function Pu(n) {
				return Ie(n) ? b(De(n)) : rr(n)
			}

			function Zu() {
				return []
			}

			function qu() {
				return false
			}
			mn = null == mn ? Fn : rt.defaults(Fn.Object(), mn, rt.pick(Fn, Wn));
			var Vu = mn.Array,
				Ku = mn.Date,
				Gu = mn.Error,
				Hu = mn.Function,
				Ju = mn.Math,
				Yu = mn.Object,
				Qu = mn.RegExp,
				Xu = mn.String,
				ni = mn.TypeError,
				ti = Vu.prototype,
				ri = Yu.prototype,
				ei = mn["__core-js_shared__"],
				ui = Hu.prototype.toString,
				ii = ri.hasOwnProperty,
				oi = 0,
				fi = function () {
					var n = /[^.]+$/.exec(ei && ei.keys && ei.keys.IE_PROTO || "");
					return n ? "Symbol(src)_1." + n : ""
				}(),
				ci = ri.toString,
				ai = ui.call(Yu),
				li = Fn._,
				si = Qu("^" + ui.call(ii).replace(rn, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"),
				hi = Zn ? mn.Buffer : T,
				pi = mn.Symbol,
				_i = mn.Uint8Array,
				vi = hi ? hi.f : T,
				gi = B(Yu.getPrototypeOf, Yu),
				di = Yu.create,
				yi = ri.propertyIsEnumerable,
				bi = ti.splice,
				xi = pi ? pi.isConcatSpreadable : T,
				ji = pi ? pi.iterator : T,
				wi = pi ? pi.toStringTag : T,
				mi = function () {
					try {
						var n = je(Yu, "defineProperty");
						return n({}, "", {}), n
					} catch (n) {}
				}(),
				Ai = mn.clearTimeout !== Fn.clearTimeout && mn.clearTimeout,
				ki = Ku && Ku.now !== Fn.Date.now && Ku.now,
				Ei = mn.setTimeout !== Fn.setTimeout && mn.setTimeout,
				Si = Ju.ceil,
				Oi = Ju.floor,
				Ii = Yu.getOwnPropertySymbols,
				Ri = hi ? hi.isBuffer : T,
				zi = mn.isFinite,
				Wi = ti.join,
				Bi = B(Yu.keys, Yu),
				Li = Ju.max,
				Ui = Ju.min,
				Ci = Ku.now,
				Di = mn.parseInt,
				Mi = Ju.random,
				Ti = ti.reverse,
				$i = je(mn, "DataView"),
				Fi = je(mn, "Map"),
				Ni = je(mn, "Promise"),
				Pi = je(mn, "Set"),
				Zi = je(mn, "WeakMap"),
				qi = je(Yu, "create"),
				Vi = Zi && new Zi,
				Ki = {},
				Gi = Me($i),
				Hi = Me(Fi),
				Ji = Me(Ni),
				Yi = Me(Pi),
				Qi = Me(Zi),
				Xi = pi ? pi.prototype : T,
				no = Xi ? Xi.valueOf : T,
				to = Xi ? Xi.toString : T,
				ro = function () {
					function n() {}
					return function (t) {
						return gu(t) ? di ? di(t) : (n.prototype = t, t = new n, n.prototype = T, t) : {}
					}
				}();
			An.templateSettings = {
				escape: J,
				evaluate: Y,
				interpolate: Q,
				variable: "",
				imports: {
					_: An
				}
			}, An.prototype = kn.prototype, An.prototype.constructor = An, On.prototype = ro(kn.prototype), On.prototype.constructor = On, Un.prototype = ro(kn.prototype), Un.prototype.constructor = Un, Cn.prototype.clear = function () {
				this.__data__ = qi ? qi(null) : {}, this.size = 0
			}, Cn.prototype.delete = function (n) {
				return n = this.has(n) && delete this.__data__[n], this.size -= n ? 1 : 0, n
			}, Cn.prototype.get = function (n) {
				var t = this.__data__;
				return qi ? (n = t[n], "__lodash_hash_undefined__" === n ? T : n) : ii.call(t, n) ? t[n] : T
			}, Cn.prototype.has = function (n) {
				var t = this.__data__;
				return qi ? t[n] !== T : ii.call(t, n)
			}, Cn.prototype.set = function (n, t) {
				var r = this.__data__;
				return this.size += this.has(n) ? 0 : 1, r[n] = qi && t === T ? "__lodash_hash_undefined__" : t, this
			}, Tn.prototype.clear = function () {
				this.__data__ = [], this.size = 0
			}, Tn.prototype.delete = function (n) {
				var t = this.__data__;
				return n = ft(t, n), !(0 > n) && (n == t.length - 1 ? t.pop() : bi.call(t, n, 1), --this.size, true)
			}, Tn.prototype.get = function (n) {
				var t = this.__data__;
				return n = ft(t, n), 0 > n ? T : t[n][1]
			}, Tn.prototype.has = function (n) {
				return -1 < ft(this.__data__, n)
			}, Tn.prototype.set = function (n, t) {
				var r = this.__data__,
					e = ft(r, n);
				return 0 > e ? (++this.size, r.push([n, t])) : r[e][1] = t, this
			}, $n.prototype.clear = function () {
				this.size = 0, this.__data__ = {
					hash: new Cn,
					map: new(Fi || Tn),
					string: new Cn
				}
			}, $n.prototype.delete = function (n) {
				return n = be(this, n).delete(n), this.size -= n ? 1 : 0, n
			}, $n.prototype.get = function (n) {
				return be(this, n).get(n);
			}, $n.prototype.has = function (n) {
				return be(this, n).has(n)
			}, $n.prototype.set = function (n, t) {
				var r = be(this, n),
					e = r.size;
				return r.set(n, t), this.size += r.size == e ? 0 : 1, this
			}, Nn.prototype.add = Nn.prototype.push = function (n) {
				return this.__data__.set(n, "__lodash_hash_undefined__"), this
			}, Nn.prototype.has = function (n) {
				return this.__data__.has(n)
			}, Pn.prototype.clear = function () {
				this.__data__ = new Tn, this.size = 0
			}, Pn.prototype.delete = function (n) {
				var t = this.__data__;
				return n = t.delete(n), this.size = t.size, n
			}, Pn.prototype.get = function (n) {
				return this.__data__.get(n)
			}, Pn.prototype.has = function (n) {
				return this.__data__.has(n)
			}, Pn.prototype.set = function (n, t) {
				var r = this.__data__;
				if (r instanceof Tn) {
					var e = r.__data__;
					if (!Fi || 199 > e.length) return e.push([n, t]), this.size = ++r.size, this;
					r = this.__data__ = new $n(e)
				}
				return r.set(n, t), this.size = r.size, this
			};
			var eo = Fr(mt),
				uo = Fr(At, true),
				io = Nr(),
				oo = Nr(true),
				fo = Vi ? function (n, t) {
					return Vi.set(n, t), n
				} : Tu,
				co = mi ? function (n, t) {
					return mi(n, "toString", {
						configurable: true,
						enumerable: false,
						value: Mu(t),
						writable: true
					})
				} : Tu,
				ao = Ai || function (n) {
					return Fn.clearTimeout(n)
				},
				lo = Pi && 1 / U(new Pi([, -0]))[1] == $ ? function (n) {
					return new Pi(n)
				} : Nu,
				so = Vi ? function (n) {
					return Vi.get(n)
				} : Nu,
				ho = Ii ? function (n) {
					return null == n ? [] : (n = Yu(n), i(Ii(n), function (t) {
						return yi.call(n, t)
					}))
				} : Zu,
				po = Ii ? function (n) {
					for (var t = []; n;) a(t, ho(n)), n = gi(n);
					return t
				} : Zu,
				_o = Ot;
			($i && "[object DataView]" != _o(new $i(new ArrayBuffer(1))) || Fi && "[object Map]" != _o(new Fi) || Ni && "[object Promise]" != _o(Ni.resolve()) || Pi && "[object Set]" != _o(new Pi) || Zi && "[object WeakMap]" != _o(new Zi)) && (_o = function (n) {
				var t = Ot(n);
				if (n = (n = "[object Object]" == t ? n.constructor : T) ? Me(n) : "") switch (n) {
					case Gi:
						return "[object DataView]";
					case Hi:
						return "[object Map]";
					case Ji:
						return "[object Promise]";
					case Yi:
						return "[object Set]";
					case Qi:
						return "[object WeakMap]"
				}
				return t
			});
			var vo = ei ? pu : qu,
				go = Ue(fo),
				yo = Ei || function (n, t) {
					return Fn.setTimeout(n, t)
				},
				bo = Ue(co),
				xo = function (n) {
					n = fu(n, function (n) {
						return 500 === t.size && t.clear(), n
					});
					var t = n.cache;
					return n
				}(function (n) {
					var t = [];
					return 46 === n.charCodeAt(0) && t.push(""), n.replace(tn, function (n, r, e, u) {
						t.push(e ? u.replace(hn, "$1") : r || n)
					}), t
				}),
				jo = fr(function (n, t) {
					return su(n) ? yt(n, wt(t, 1, su, true)) : []
				}),
				wo = fr(function (n, t) {
					var r = qe(t);
					return su(r) && (r = T), su(n) ? yt(n, wt(t, 1, su, true), ye(r, 2)) : []
				}),
				mo = fr(function (n, t) {
					var r = qe(t);
					return su(r) && (r = T), su(n) ? yt(n, wt(t, 1, su, true), T, r) : []
				}),
				Ao = fr(function (n) {
					var t = c(n, kr);
					return t.length && t[0] === n[0] ? Wt(t) : []
				}),
				ko = fr(function (n) {
					var t = qe(n),
						r = c(n, kr);
					return t === qe(r) ? t = T : r.pop(), r.length && r[0] === n[0] ? Wt(r, ye(t, 2)) : []
				}),
				Eo = fr(function (n) {
					var t = qe(n),
						r = c(n, kr);
					return (t = typeof t == "function" ? t : T) && r.pop(), r.length && r[0] === n[0] ? Wt(r, T, t) : []
				}),
				So = fr(Ve),
				Oo = pe(function (n, t) {
					var r = null == n ? 0 : n.length,
						e = ht(n, t);
					return ur(n, c(t, function (n) {
						return Se(n, r) ? +n : n
					}).sort(Wr)), e
				}),
				Io = fr(function (n) {
					return br(wt(n, 1, su, true))
				}),
				Ro = fr(function (n) {
					var t = qe(n);
					return su(t) && (t = T), br(wt(n, 1, su, true), ye(t, 2))
				}),
				zo = fr(function (n) {
					var t = qe(n),
						t = typeof t == "function" ? t : T;
					return br(wt(n, 1, su, true), T, t)
				}),
				Wo = fr(function (n, t) {
					return su(n) ? yt(n, t) : []
				}),
				Bo = fr(function (n) {
					return mr(i(n, su))
				}),
				Lo = fr(function (n) {
					var t = qe(n);
					return su(t) && (t = T), mr(i(n, su), ye(t, 2))
				}),
				Uo = fr(function (n) {
					var t = qe(n),
						t = typeof t == "function" ? t : T;
					return mr(i(n, su), T, t)
				}),
				Co = fr(Ge),
				Do = fr(function (n) {
					var t = n.length,
						t = 1 < t ? n[t - 1] : T,
						t = typeof t == "function" ? (n.pop(), t) : T;
					return He(n, t)
				}),
				Mo = pe(function (n) {
					function t(t) {
						return ht(t, n)
					}
					var r = n.length,
						e = r ? n[0] : 0,
						u = this.__wrapped__;
					return !(1 < r || this.__actions__.length) && u instanceof Un && Se(e) ? (u = u.slice(e, +e + (r ? 1 : 0)), u.__actions__.push({
						func: Ye,
						args: [t],
						thisArg: T
					}), new On(u, this.__chain__).thru(function (n) {
						return r && !n.length && n.push(T), n
					})) : this.thru(t)
				}),
				To = Tr(function (n, t, r) {
					ii.call(n, r) ? ++n[r] : st(n, r, 1)
				}),
				$o = Gr(Fe),
				Fo = Gr(Ne),
				No = Tr(function (n, t, r) {
					ii.call(n, r) ? n[r].push(t) : st(n, r, [t])
				}),
				Po = fr(function (t, r, e) {
					var u = -1,
						i = typeof r == "function",
						o = lu(t) ? Vu(t.length) : [];
					return eo(t, function (t) {
						o[++u] = i ? n(r, t, e) : Lt(t, r, e)
					}), o
				}),
				Zo = Tr(function (n, t, r) {
					st(n, r, t)
				}),
				qo = Tr(function (n, t, r) {
					n[r ? 0 : 1].push(t)
				}, function () {
					return [
						[],
						[]
					]
				}),
				Vo = fr(function (n, t) {
					if (null == n) return [];
					var r = t.length;
					return 1 < r && Oe(n, t[0], t[1]) ? t = [] : 2 < r && Oe(t[0], t[1], t[2]) && (t = [t[0]]), Xt(n, wt(t, 1), [])
				}),
				Ko = ki || function () {
					return Fn.Date.now()
				},
				Go = fr(function (n, t, r) {
					var e = 1;
					if (r.length) var u = L(r, de(Go)),
						e = 32 | e;
					return fe(n, e, t, r, u)
				}),
				Ho = fr(function (n, t, r) {
					var e = 3;
					if (r.length) var u = L(r, de(Ho)),
						e = 32 | e;
					return fe(t, e, n, r, u)
				}),
				Jo = fr(function (n, t) {
					return dt(n, 1, t)
				}),
				Yo = fr(function (n, t, r) {
					return dt(n, Eu(t) || 0, r)
				});
			fu.Cache = $n;
			var Qo = fr(function (t, r) {
					r = 1 == r.length && of (r[0]) ? c(r[0], E(ye())) : c(wt(r, 1), E(ye()));
					var e = r.length;
					return fr(function (u) {
						for (var i = -1, o = Ui(u.length, e); ++i < o;) u[i] = r[i].call(this, u[i]);
						return n(t, this, u)
					})
				}),
				Xo = fr(function (n, t) {
					return fe(n, 32, T, t, L(t, de(Xo)))
				}),
				nf = fr(function (n, t) {
					return fe(n, 64, T, t, L(t, de(nf)))
				}),
				tf = pe(function (n, t) {
					return fe(n, 256, T, T, T, t)
				}),
				rf = ee(It),
				ef = ee(function (n, t) {
					return n >= t
				}),
				uf = Ut(function () {
					return arguments
				}()) ? Ut : function (n) {
					return du(n) && ii.call(n, "callee") && !yi.call(n, "callee")
				},
				of = Vu.isArray,
				ff = Vn ? E(Vn) : Ct,
				cf = Ri || qu,
				af = Kn ? E(Kn) : Dt,
				lf = Gn ? E(Gn) : Tt,
				sf = Hn ? E(Hn) : Nt,
				hf = Jn ? E(Jn) : Pt,
				pf = Yn ? E(Yn) : Zt,
				_f = ee(Kt),
				vf = ee(function (n, t) {
					return n <= t
				}),
				gf = $r(function (n, t) {
					if (ze(t) || lu(t)) Cr(t, zu(t), n);
					else
						for (var r in t) ii.call(t, r) && ot(n, r, t[r])
				}),
				df = $r(function (n, t) {
					Cr(t, Wu(t), n)
				}),
				yf = $r(function (n, t, r, e) {
					Cr(t, Wu(t), n, e)
				}),
				bf = $r(function (n, t, r, e) {
					Cr(t, zu(t), n, e)
				}),
				xf = pe(ht),
				jf = fr(function (n, t) {
					n = Yu(n);
					var r = -1,
						e = t.length,
						u = 2 < e ? t[2] : T;
					for (u && Oe(t[0], t[1], u) && (e = 1); ++r < e;)
						for (var u = t[r], i = Wu(u), o = -1, f = i.length; ++o < f;) {
							var c = i[o],
								a = n[c];
							(a === T || au(a, ri[c]) && !ii.call(n, c)) && (n[c] = u[c])
						}
					return n
				}),
				wf = fr(function (t) {
					return t.push(T, ae), n(Sf, T, t)
				}),
				mf = Yr(function (n, t, r) {
					null != t && typeof t.toString != "function" && (t = ci.call(t)), n[t] = r
				}, Mu(Tu)),
				Af = Yr(function (n, t, r) {
					null != t && typeof t.toString != "function" && (t = ci.call(t)), ii.call(n, t) ? n[t].push(r) : n[t] = [r]
				}, ye),
				kf = fr(Lt),
				Ef = $r(function (n, t, r) {
					Yt(n, t, r)
				}),
				Sf = $r(function (n, t, r, e) {
					Yt(n, t, r, e)
				}),
				Of = pe(function (n, t) {
					var r = {};
					if (null == n) return r;
					var e = false;
					t = c(t, function (t) {
						return t = Sr(t, n), e || (e = 1 < t.length), t
					}), Cr(n, ve(n), r), e && (r = _t(r, 7, le));
					for (var u = t.length; u--;) xr(r, t[u]);
					return r
				}),
				If = pe(function (n, t) {
					return null == n ? {} : nr(n, t);
				}),
				Rf = oe(zu),
				zf = oe(Wu),
				Wf = qr(function (n, t, r) {
					return t = t.toLowerCase(), n + (r ? Uu(t) : t)
				}),
				Bf = qr(function (n, t, r) {
					return n + (r ? "-" : "") + t.toLowerCase()
				}),
				Lf = qr(function (n, t, r) {
					return n + (r ? " " : "") + t.toLowerCase()
				}),
				Uf = Zr("toLowerCase"),
				Cf = qr(function (n, t, r) {
					return n + (r ? "_" : "") + t.toLowerCase()
				}),
				Df = qr(function (n, t, r) {
					return n + (r ? " " : "") + Tf(t)
				}),
				Mf = qr(function (n, t, r) {
					return n + (r ? " " : "") + t.toUpperCase()
				}),
				Tf = Zr("toUpperCase"),
				$f = fr(function (t, r) {
					try {
						return n(t, T, r)
					} catch (n) {
						return hu(n) ? n : new Gu(n)
					}
				}),
				Ff = pe(function (n, t) {
					return r(t, function (t) {
						t = De(t), st(n, t, Go(n[t], n))
					}), n
				}),
				Nf = Hr(),
				Pf = Hr(true),
				Zf = fr(function (n, t) {
					return function (r) {
						return Lt(r, n, t)
					}
				}),
				qf = fr(function (n, t) {
					return function (r) {
						return Lt(n, r, t)
					}
				}),
				Vf = Xr(c),
				Kf = Xr(u),
				Gf = Xr(h),
				Hf = re(),
				Jf = re(true),
				Yf = Qr(function (n, t) {
					return n + t
				}, 0),
				Qf = ie("ceil"),
				Xf = Qr(function (n, t) {
					return n / t
				}, 1),
				nc = ie("floor"),
				tc = Qr(function (n, t) {
					return n * t
				}, 1),
				rc = ie("round"),
				ec = Qr(function (n, t) {
					return n - t
				}, 0);
			return An.after = function (n, t) {
				if (typeof t != "function") throw new ni("Expected a function");
				return n = Au(n),
					function () {
						if (1 > --n) return t.apply(this, arguments)
					}
			}, An.ary = ru, An.assign = gf, An.assignIn = df, An.assignInWith = yf, An.assignWith = bf, An.at = xf, An.before = eu, An.bind = Go, An.bindAll = Ff, An.bindKey = Ho, An.castArray = function () {
				if (!arguments.length) return [];
				var n = arguments[0];
				return of(n) ? n : [n]
			}, An.chain = Je, An.chunk = function (n, t, r) {
				if (t = (r ? Oe(n, t, r) : t === T) ? 1 : Li(Au(t), 0), r = null == n ? 0 : n.length, !r || 1 > t) return [];
				for (var e = 0, u = 0, i = Vu(Si(r / t)); e < r;) i[u++] = hr(n, e, e += t);
				return i
			}, An.compact = function (n) {
				for (var t = -1, r = null == n ? 0 : n.length, e = 0, u = []; ++t < r;) {
					var i = n[t];
					i && (u[e++] = i)
				}
				return u
			}, An.concat = function () {
				var n = arguments.length;
				if (!n) return [];
				for (var t = Vu(n - 1), r = arguments[0]; n--;) t[n - 1] = arguments[n];
				return a( of (r) ? Ur(r) : [r], wt(t, 1))
			}, An.cond = function (t) {
				var r = null == t ? 0 : t.length,
					e = ye();
				return t = r ? c(t, function (n) {
					if ("function" != typeof n[1]) throw new ni("Expected a function");
					return [e(n[0]), n[1]]
				}) : [], fr(function (e) {
					for (var u = -1; ++u < r;) {
						var i = t[u];
						if (n(i[0], this, e)) return n(i[1], this, e)
					}
				})
			}, An.conforms = function (n) {
				return vt(_t(n, 1))
			}, An.constant = Mu, An.countBy = To, An.create = function (n, t) {
				var r = ro(n);
				return null == t ? r : at(r, t)
			}, An.curry = uu, An.curryRight = iu, An.debounce = ou, An.defaults = jf, An.defaultsDeep = wf, An.defer = Jo, An.delay = Yo, An.difference = jo, An.differenceBy = wo, An.differenceWith = mo, An.drop = function (n, t, r) {
				var e = null == n ? 0 : n.length;
				return e ? (t = r || t === T ? 1 : Au(t), hr(n, 0 > t ? 0 : t, e)) : []
			}, An.dropRight = function (n, t, r) {
				var e = null == n ? 0 : n.length;
				return e ? (t = r || t === T ? 1 : Au(t), t = e - t, hr(n, 0, 0 > t ? 0 : t)) : []
			}, An.dropRightWhile = function (n, t) {
				return n && n.length ? jr(n, ye(t, 3), true, true) : [];
			}, An.dropWhile = function (n, t) {
				return n && n.length ? jr(n, ye(t, 3), true) : []
			}, An.fill = function (n, t, r, e) {
				var u = null == n ? 0 : n.length;
				if (!u) return [];
				for (r && typeof r != "number" && Oe(n, t, r) && (r = 0, e = u), u = n.length, r = Au(r), 0 > r && (r = -r > u ? 0 : u + r), e = e === T || e > u ? u : Au(e), 0 > e && (e += u), e = r > e ? 0 : ku(e); r < e;) n[r++] = t;
				return n
			}, An.filter = function (n, t) {
				return ( of (n) ? i : jt)(n, ye(t, 3))
			}, An.flatMap = function (n, t) {
				return wt(tu(n, t), 1)
			}, An.flatMapDeep = function (n, t) {
				return wt(tu(n, t), $)
			}, An.flatMapDepth = function (n, t, r) {
				return r = r === T ? 1 : Au(r), wt(tu(n, t), r)
			}, An.flatten = Pe, An.flattenDeep = function (n) {
				return (null == n ? 0 : n.length) ? wt(n, $) : []
			}, An.flattenDepth = function (n, t) {
				return null != n && n.length ? (t = t === T ? 1 : Au(t), wt(n, t)) : []
			}, An.flip = function (n) {
				return fe(n, 512)
			}, An.flow = Nf, An.flowRight = Pf, An.fromPairs = function (n) {
				for (var t = -1, r = null == n ? 0 : n.length, e = {}; ++t < r;) {
					var u = n[t];
					e[u[0]] = u[1]
				}
				return e
			}, An.functions = function (n) {
				return null == n ? [] : kt(n, zu(n))
			}, An.functionsIn = function (n) {
				return null == n ? [] : kt(n, Wu(n))
			}, An.groupBy = No, An.initial = function (n) {
				return (null == n ? 0 : n.length) ? hr(n, 0, -1) : []
			}, An.intersection = Ao, An.intersectionBy = ko, An.intersectionWith = Eo, An.invert = mf, An.invertBy = Af, An.invokeMap = Po, An.iteratee = $u, An.keyBy = Zo, An.keys = zu, An.keysIn = Wu, An.map = tu, An.mapKeys = function (n, t) {
				var r = {};
				return t = ye(t, 3), mt(n, function (n, e, u) {
					st(r, t(n, e, u), n)
				}), r
			}, An.mapValues = function (n, t) {
				var r = {};
				return t = ye(t, 3), mt(n, function (n, e, u) {
					st(r, e, t(n, e, u))
				}), r
			}, An.matches = function (n) {
				return Ht(_t(n, 1))
			}, An.matchesProperty = function (n, t) {
				return Jt(n, _t(t, 1))
			}, An.memoize = fu, An.merge = Ef, An.mergeWith = Sf, An.method = Zf, An.methodOf = qf, An.mixin = Fu, An.negate = cu, An.nthArg = function (n) {
				return n = Au(n), fr(function (t) {
					return Qt(t, n)
				})
			}, An.omit = Of, An.omitBy = function (n, t) {
				return Bu(n, cu(ye(t)))
			}, An.once = function (n) {
				return eu(2, n)
			}, An.orderBy = function (n, t, r, e) {
				return null == n ? [] : ( of (t) || (t = null == t ? [] : [t]), r = e ? T : r, of (r) || (r = null == r ? [] : [r]), Xt(n, t, r))
			}, An.over = Vf, An.overArgs = Qo, An.overEvery = Kf, An.overSome = Gf, An.partial = Xo, An.partialRight = nf, An.partition = qo, An.pick = If, An.pickBy = Bu, An.property = Pu, An.propertyOf = function (n) {
				return function (t) {
					return null == n ? T : Et(n, t)
				}
			}, An.pull = So, An.pullAll = Ve, An.pullAllBy = function (n, t, r) {
				return n && n.length && t && t.length ? er(n, t, ye(r, 2)) : n
			}, An.pullAllWith = function (n, t, r) {
				return n && n.length && t && t.length ? er(n, t, T, r) : n
			}, An.pullAt = Oo, An.range = Hf, An.rangeRight = Jf, An.rearg = tf, An.reject = function (n, t) {
				return ( of (n) ? i : jt)(n, cu(ye(t, 3)))
			}, An.remove = function (n, t) {
				var r = [];
				if (!n || !n.length) return r;
				var e = -1,
					u = [],
					i = n.length;
				for (t = ye(t, 3); ++e < i;) {
					var o = n[e];
					t(o, e, n) && (r.push(o), u.push(e))
				}
				return ur(n, u), r
			}, An.rest = function (n, t) {
				if (typeof n != "function") throw new ni("Expected a function");
				return t = t === T ? t : Au(t), fr(n, t)
			}, An.reverse = Ke, An.sampleSize = function (n, t, r) {
				return t = (r ? Oe(n, t, r) : t === T) ? 1 : Au(t), ( of (n) ? et : ar)(n, t)
			}, An.set = function (n, t, r) {
				return null == n ? n : lr(n, t, r)
			}, An.setWith = function (n, t, r, e) {
				return e = typeof e == "function" ? e : T, null == n ? n : lr(n, t, r, e)
			}, An.shuffle = function (n) {
				return ( of (n) ? ut : sr)(n)
			}, An.slice = function (n, t, r) {
				var e = null == n ? 0 : n.length;
				return e ? (r && typeof r != "number" && Oe(n, t, r) ? (t = 0, r = e) : (t = null == t ? 0 : Au(t), r = r === T ? e : Au(r)), hr(n, t, r)) : []
			}, An.sortBy = Vo, An.sortedUniq = function (n) {
				return n && n.length ? gr(n) : []
			}, An.sortedUniqBy = function (n, t) {
				return n && n.length ? gr(n, ye(t, 2)) : []
			}, An.split = function (n, t, r) {
				return r && typeof r != "number" && Oe(n, t, r) && (t = r = T), r = r === T ? 4294967295 : r >>> 0, r ? (n = Ou(n)) && (typeof t == "string" || null != t && !sf(t)) && (t = yr(t), !t && Rn.test(n)) ? Or(M(n), 0, r) : n.split(t, r) : []
			}, An.spread = function (t, r) {
				if (typeof t != "function") throw new ni("Expected a function");
				return r = null == r ? 0 : Li(Au(r), 0), fr(function (e) {
					var u = e[r];
					return e = Or(e, 0, r), u && a(e, u), n(t, this, e)
				})
			}, An.tail = function (n) {
				var t = null == n ? 0 : n.length;
				return t ? hr(n, 1, t) : []
			}, An.take = function (n, t, r) {
				return n && n.length ? (t = r || t === T ? 1 : Au(t), hr(n, 0, 0 > t ? 0 : t)) : []
			}, An.takeRight = function (n, t, r) {
				var e = null == n ? 0 : n.length;
				return e ? (t = r || t === T ? 1 : Au(t), t = e - t, hr(n, 0 > t ? 0 : t, e)) : []
			}, An.takeRightWhile = function (n, t) {
				return n && n.length ? jr(n, ye(t, 3), false, true) : []
			}, An.takeWhile = function (n, t) {
				return n && n.length ? jr(n, ye(t, 3)) : []
			}, An.tap = function (n, t) {
				return t(n), n
			}, An.throttle = function (n, t, r) {
				var e = true,
					u = true;
				if (typeof n != "function") throw new ni("Expected a function");
				return gu(r) && (e = "leading" in r ? !!r.leading : e, u = "trailing" in r ? !!r.trailing : u), ou(n, t, {
					leading: e,
					maxWait: t,
					trailing: u
				})
			}, An.thru = Ye, An.toArray = wu, An.toPairs = Rf, An.toPairsIn = zf, An.toPath = function (n) {
				return of(n) ? c(n, De) : ju(n) ? [n] : Ur(xo(Ou(n)))
			}, An.toPlainObject = Su, An.transform = function (n, t, e) {
				var u = of (n),
					i = u || cf(n) || pf(n);
				if (t = ye(t, 4), null == e) {
					var o = n && n.constructor;
					e = i ? u ? new o : [] : gu(n) && pu(o) ? ro(gi(n)) : {};
				}
				return (i ? r : mt)(n, function (n, r, u) {
					return t(e, n, r, u)
				}), e
			}, An.unary = function (n) {
				return ru(n, 1)
			}, An.union = Io, An.unionBy = Ro, An.unionWith = zo, An.uniq = function (n) {
				return n && n.length ? br(n) : []
			}, An.uniqBy = function (n, t) {
				return n && n.length ? br(n, ye(t, 2)) : []
			}, An.uniqWith = function (n, t) {
				return t = typeof t == "function" ? t : T, n && n.length ? br(n, T, t) : []
			}, An.unset = function (n, t) {
				return null == n || xr(n, t)
			}, An.unzip = Ge, An.unzipWith = He, An.update = function (n, t, r) {
				return null == n ? n : lr(n, t, Er(r)(Et(n, t)), void 0)
			}, An.updateWith = function (n, t, r, e) {
				return e = typeof e == "function" ? e : T, null != n && (n = lr(n, t, Er(r)(Et(n, t)), e)), n
			}, An.values = Lu, An.valuesIn = function (n) {
				return null == n ? [] : S(n, Wu(n))
			}, An.without = Wo, An.words = Du, An.wrap = function (n, t) {
				return Xo(Er(t), n)
			}, An.xor = Bo, An.xorBy = Lo, An.xorWith = Uo, An.zip = Co, An.zipObject = function (n, t) {
				return Ar(n || [], t || [], ot)
			}, An.zipObjectDeep = function (n, t) {
				return Ar(n || [], t || [], lr)
			}, An.zipWith = Do, An.entries = Rf, An.entriesIn = zf, An.extend = df, An.extendWith = yf, Fu(An, An), An.add = Yf, An.attempt = $f, An.camelCase = Wf, An.capitalize = Uu, An.ceil = Qf, An.clamp = function (n, t, r) {
				return r === T && (r = t, t = T), r !== T && (r = Eu(r), r = r === r ? r : 0), t !== T && (t = Eu(t), t = t === t ? t : 0), pt(Eu(n), t, r)
			}, An.clone = function (n) {
				return _t(n, 4)
			}, An.cloneDeep = function (n) {
				return _t(n, 5)
			}, An.cloneDeepWith = function (n, t) {
				return t = typeof t == "function" ? t : T, _t(n, 5, t)
			}, An.cloneWith = function (n, t) {
				return t = typeof t == "function" ? t : T, _t(n, 4, t)
			}, An.conformsTo = function (n, t) {
				return null == t || gt(n, t, zu(t))
			}, An.deburr = Cu, An.defaultTo = function (n, t) {
				return null == n || n !== n ? t : n
			}, An.divide = Xf, An.endsWith = function (n, t, r) {
				n = Ou(n), t = yr(t);
				var e = n.length,
					e = r = r === T ? e : pt(Au(r), 0, e);
				return r -= t.length, 0 <= r && n.slice(r, e) == t
			}, An.eq = au, An.escape = function (n) {
				return (n = Ou(n)) && H.test(n) ? n.replace(K, nt) : n
			}, An.escapeRegExp = function (n) {
				return (n = Ou(n)) && en.test(n) ? n.replace(rn, "\\$&") : n
			}, An.every = function (n, t, r) {
				var e = of (n) ? u : bt;
				return r && Oe(n, t, r) && (t = T), e(n, ye(t, 3))
			}, An.find = $o, An.findIndex = Fe, An.findKey = function (n, t) {
				return p(n, ye(t, 3), mt)
			}, An.findLast = Fo, An.findLastIndex = Ne, An.findLastKey = function (n, t) {
				return p(n, ye(t, 3), At);
			}, An.floor = nc, An.forEach = Xe, An.forEachRight = nu, An.forIn = function (n, t) {
				return null == n ? n : io(n, ye(t, 3), Wu)
			}, An.forInRight = function (n, t) {
				return null == n ? n : oo(n, ye(t, 3), Wu)
			}, An.forOwn = function (n, t) {
				return n && mt(n, ye(t, 3))
			}, An.forOwnRight = function (n, t) {
				return n && At(n, ye(t, 3))
			}, An.get = Iu, An.gt = rf, An.gte = ef, An.has = function (n, t) {
				return null != n && we(n, t, Rt)
			}, An.hasIn = Ru, An.head = Ze, An.identity = Tu, An.includes = function (n, t, r, e) {
				return n = lu(n) ? n : Lu(n), r = r && !e ? Au(r) : 0, e = n.length, 0 > r && (r = Li(e + r, 0)), xu(n) ? r <= e && -1 < n.indexOf(t, r) : !!e && -1 < v(n, t, r);
			}, An.indexOf = function (n, t, r) {
				var e = null == n ? 0 : n.length;
				return e ? (r = null == r ? 0 : Au(r), 0 > r && (r = Li(e + r, 0)), v(n, t, r)) : -1
			}, An.inRange = function (n, t, r) {
				return t = mu(t), r === T ? (r = t, t = 0) : r = mu(r), n = Eu(n), n >= Ui(t, r) && n < Li(t, r)
			}, An.invoke = kf, An.isArguments = uf, An.isArray = of , An.isArrayBuffer = ff, An.isArrayLike = lu, An.isArrayLikeObject = su, An.isBoolean = function (n) {
				return true === n || false === n || du(n) && "[object Boolean]" == Ot(n)
			}, An.isBuffer = cf, An.isDate = af, An.isElement = function (n) {
				return du(n) && 1 === n.nodeType && !bu(n)
			}, An.isEmpty = function (n) {
				if (null == n) return true;
				if (lu(n) && ( of (n) || typeof n == "string" || typeof n.splice == "function" || cf(n) || pf(n) || uf(n))) return !n.length;
				var t = _o(n);
				if ("[object Map]" == t || "[object Set]" == t) return !n.size;
				if (ze(n)) return !Vt(n).length;
				for (var r in n)
					if (ii.call(n, r)) return false;
				return true
			}, An.isEqual = function (n, t) {
				return Mt(n, t)
			}, An.isEqualWith = function (n, t, r) {
				var e = (r = typeof r == "function" ? r : T) ? r(n, t) : T;
				return e === T ? Mt(n, t, T, r) : !!e
			}, An.isError = hu, An.isFinite = function (n) {
				return typeof n == "number" && zi(n)
			}, An.isFunction = pu, An.isInteger = _u, An.isLength = vu, An.isMap = lf, An.isMatch = function (n, t) {
				return n === t || $t(n, t, xe(t))
			}, An.isMatchWith = function (n, t, r) {
				return r = typeof r == "function" ? r : T, $t(n, t, xe(t), r)
			}, An.isNaN = function (n) {
				return yu(n) && n != +n
			}, An.isNative = function (n) {
				if (vo(n)) throw new Gu("Unsupported core-js use. Try https://npms.io/search?q=ponyfill.");
				return Ft(n)
			}, An.isNil = function (n) {
				return null == n
			}, An.isNull = function (n) {
				return null === n
			}, An.isNumber = yu, An.isObject = gu, An.isObjectLike = du, An.isPlainObject = bu, An.isRegExp = sf, An.isSafeInteger = function (n) {
				return _u(n) && -9007199254740991 <= n && 9007199254740991 >= n
			}, An.isSet = hf, An.isString = xu, An.isSymbol = ju, An.isTypedArray = pf, An.isUndefined = function (n) {
				return n === T
			}, An.isWeakMap = function (n) {
				return du(n) && "[object WeakMap]" == _o(n)
			}, An.isWeakSet = function (n) {
				return du(n) && "[object WeakSet]" == Ot(n)
			}, An.join = function (n, t) {
				return null == n ? "" : Wi.call(n, t)
			}, An.kebabCase = Bf, An.last = qe, An.lastIndexOf = function (n, t, r) {
				var e = null == n ? 0 : n.length;
				if (!e) return -1;
				var u = e;
				if (r !== T && (u = Au(r), u = 0 > u ? Li(e + u, 0) : Ui(u, e - 1)), t === t) {
					for (r = u + 1; r-- && n[r] !== t;);
					n = r
				} else n = _(n, d, u, true);
				return n
			}, An.lowerCase = Lf, An.lowerFirst = Uf, An.lt = _f, An.lte = vf, An.max = function (n) {
				return n && n.length ? xt(n, Tu, It) : T
			}, An.maxBy = function (n, t) {
				return n && n.length ? xt(n, ye(t, 2), It) : T
			}, An.mean = function (n) {
				return y(n, Tu)
			}, An.meanBy = function (n, t) {
				return y(n, ye(t, 2))
			}, An.min = function (n) {
				return n && n.length ? xt(n, Tu, Kt) : T
			}, An.minBy = function (n, t) {
				return n && n.length ? xt(n, ye(t, 2), Kt) : T
			}, An.stubArray = Zu, An.stubFalse = qu, An.stubObject = function () {
				return {}
			}, An.stubString = function () {
				return ""
			}, An.stubTrue = function () {
				return true
			}, An.multiply = tc, An.nth = function (n, t) {
				return n && n.length ? Qt(n, Au(t)) : T
			}, An.noConflict = function () {
				return Fn._ === this && (Fn._ = li), this
			}, An.noop = Nu, An.now = Ko, An.pad = function (n, t, r) {
				n = Ou(n);
				var e = (t = Au(t)) ? D(n) : 0;
				return !t || e >= t ? n : (t = (t - e) / 2, ne(Oi(t), r) + n + ne(Si(t), r))
			}, An.padEnd = function (n, t, r) {
				n = Ou(n);
				var e = (t = Au(t)) ? D(n) : 0;
				return t && e < t ? n + ne(t - e, r) : n
			}, An.padStart = function (n, t, r) {
				n = Ou(n);
				var e = (t = Au(t)) ? D(n) : 0;
				return t && e < t ? ne(t - e, r) + n : n
			}, An.parseInt = function (n, t, r) {
				return r || null == t ? t = 0 : t && (t = +t), Di(Ou(n).replace(on, ""), t || 0)
			}, An.random = function (n, t, r) {
				if (r && typeof r != "boolean" && Oe(n, t, r) && (t = r = T), r === T && (typeof t == "boolean" ? (r = t, t = T) : typeof n == "boolean" && (r = n, n = T)), n === T && t === T ? (n = 0, t = 1) : (n = mu(n), t === T ? (t = n, n = 0) : t = mu(t)), n > t) {
					var e = n;
					n = t, t = e
				}
				return r || n % 1 || t % 1 ? (r = Mi(), Ui(n + r * (t - n + Dn("1e-" + ((r + "").length - 1))), t)) : ir(n, t)
			}, An.reduce = function (n, t, r) {
				var e = of (n) ? l : j,
					u = 3 > arguments.length;
				return e(n, ye(t, 4), r, u, eo)
			}, An.reduceRight = function (n, t, r) {
				var e = of (n) ? s : j,
					u = 3 > arguments.length;
				return e(n, ye(t, 4), r, u, uo)
			}, An.repeat = function (n, t, r) {
				return t = (r ? Oe(n, t, r) : t === T) ? 1 : Au(t), or(Ou(n), t)
			}, An.replace = function () {
				var n = arguments,
					t = Ou(n[0]);
				return 3 > n.length ? t : t.replace(n[1], n[2])
			}, An.result = function (n, t, r) {
				t = Sr(t, n);
				var e = -1,
					u = t.length;
				for (u || (u = 1, n = T); ++e < u;) {
					var i = null == n ? T : n[De(t[e])];
					i === T && (e = u, i = r), n = pu(i) ? i.call(n) : i
				}
				return n
			}, An.round = rc, An.runInContext = x, An.sample = function (n) {
				return ( of (n) ? Qn : cr)(n)
			}, An.size = function (n) {
				if (null == n) return 0;
				if (lu(n)) return xu(n) ? D(n) : n.length;
				var t = _o(n);
				return "[object Map]" == t || "[object Set]" == t ? n.size : Vt(n).length
			}, An.snakeCase = Cf, An.some = function (n, t, r) {
				var e = of (n) ? h : pr;
				return r && Oe(n, t, r) && (t = T), e(n, ye(t, 3))
			}, An.sortedIndex = function (n, t) {
				return _r(n, t)
			}, An.sortedIndexBy = function (n, t, r) {
				return vr(n, t, ye(r, 2))
			}, An.sortedIndexOf = function (n, t) {
				var r = null == n ? 0 : n.length;
				if (r) {
					var e = _r(n, t);
					if (e < r && au(n[e], t)) return e
				}
				return -1
			}, An.sortedLastIndex = function (n, t) {
				return _r(n, t, true)
			}, An.sortedLastIndexBy = function (n, t, r) {
				return vr(n, t, ye(r, 2), true);
			}, An.sortedLastIndexOf = function (n, t) {
				if (null == n ? 0 : n.length) {
					var r = _r(n, t, true) - 1;
					if (au(n[r], t)) return r
				}
				return -1
			}, An.startCase = Df, An.startsWith = function (n, t, r) {
				return n = Ou(n), r = null == r ? 0 : pt(Au(r), 0, n.length), t = yr(t), n.slice(r, r + t.length) == t
			}, An.subtract = ec, An.sum = function (n) {
				return n && n.length ? m(n, Tu) : 0
			}, An.sumBy = function (n, t) {
				return n && n.length ? m(n, ye(t, 2)) : 0
			}, An.template = function (n, t, r) {
				var e = An.templateSettings;
				r && Oe(n, t, r) && (t = T), n = Ou(n), t = yf({}, t, e, ce), r = yf({}, t.imports, e.imports, ce);
				var u, i, o = zu(r),
					f = S(r, o),
					c = 0;
				r = t.interpolate || jn;
				var a = "__p+='";
				r = Qu((t.escape || jn).source + "|" + r.source + "|" + (r === Q ? pn : jn).source + "|" + (t.evaluate || jn).source + "|$", "g");
				var l = "sourceURL" in t ? "//# sourceURL=" + t.sourceURL + "\n" : "";
				if (n.replace(r, function (t, r, e, o, f, l) {
						return e || (e = o), a += n.slice(c, l).replace(wn, z), r && (u = true, a += "'+__e(" + r + ")+'"), f && (i = true, a += "';" + f + ";\n__p+='"), e && (a += "'+((__t=(" + e + "))==null?'':__t)+'"), c = l + t.length, t
					}), a += "';", (t = t.variable) || (a = "with(obj){" + a + "}"), a = (i ? a.replace(P, "") : a).replace(Z, "$1").replace(q, "$1;"), a = "function(" + (t || "obj") + "){" + (t ? "" : "obj||(obj={});") + "var __t,__p=''" + (u ? ",__e=_.escape" : "") + (i ? ",__j=Array.prototype.join;function print(){__p+=__j.call(arguments,'')}" : ";") + a + "return __p}", t = $f(function () {
						return Hu(o, l + "return " + a).apply(T, f)
					}), t.source = a, hu(t)) throw t;
				return t
			}, An.times = function (n, t) {
				if (n = Au(n), 1 > n || 9007199254740991 < n) return [];
				var r = 4294967295,
					e = Ui(n, 4294967295);
				for (t = ye(t), n -= 4294967295, e = A(e, t); ++r < n;) t(r);
				return e
			}, An.toFinite = mu, An.toInteger = Au, An.toLength = ku, An.toLower = function (n) {
				return Ou(n).toLowerCase()
			}, An.toNumber = Eu, An.toSafeInteger = function (n) {
				return n ? pt(Au(n), -9007199254740991, 9007199254740991) : 0 === n ? n : 0
			}, An.toString = Ou, An.toUpper = function (n) {
				return Ou(n).toUpperCase()
			}, An.trim = function (n, t, r) {
				return (n = Ou(n)) && (r || t === T) ? n.replace(un, "") : n && (t = yr(t)) ? (n = M(n), r = M(t), t = I(n, r), r = R(n, r) + 1, Or(n, t, r).join("")) : n
			}, An.trimEnd = function (n, t, r) {
				return (n = Ou(n)) && (r || t === T) ? n.replace(fn, "") : n && (t = yr(t)) ? (n = M(n), t = R(n, M(t)) + 1, Or(n, 0, t).join("")) : n
			}, An.trimStart = function (n, t, r) {
				return (n = Ou(n)) && (r || t === T) ? n.replace(on, "") : n && (t = yr(t)) ? (n = M(n), t = I(n, M(t)), Or(n, t).join("")) : n
			}, An.truncate = function (n, t) {
				var r = 30,
					e = "...";
				if (gu(t)) var u = "separator" in t ? t.separator : u,
					r = "length" in t ? Au(t.length) : r,
					e = "omission" in t ? yr(t.omission) : e;
				n = Ou(n);
				var i = n.length;
				if (Rn.test(n)) var o = M(n),
					i = o.length;
				if (r >= i) return n;
				if (i = r - D(e), 1 > i) return e;
				if (r = o ? Or(o, 0, i).join("") : n.slice(0, i), u === T) return r + e;
				if (o && (i += r.length - i), sf(u)) {
					if (n.slice(i).search(u)) {
						var f = r;
						for (u.global || (u = Qu(u.source, Ou(_n.exec(u)) + "g")), u.lastIndex = 0; o = u.exec(f);) var c = o.index;
						r = r.slice(0, c === T ? i : c)
					}
				} else n.indexOf(yr(u), i) != i && (u = r.lastIndexOf(u), -1 < u && (r = r.slice(0, u)));
				return r + e
			}, An.unescape = function (n) {
				return (n = Ou(n)) && G.test(n) ? n.replace(V, tt) : n
			}, An.uniqueId = function (n) {
				var t = ++oi;
				return Ou(n) + t
			}, An.upperCase = Mf, An.upperFirst = Tf, An.each = Xe, An.eachRight = nu, An.first = Ze, Fu(An, function () {
				var n = {};
				return mt(An, function (t, r) {
					ii.call(An.prototype, r) || (n[r] = t)
				}), n
			}(), {
				chain: false
			}), An.VERSION = "4.17.5", r("bind bindKey curry curryRight partial partialRight".split(" "), function (n) {
				An[n].placeholder = An
			}), r(["drop", "take"], function (n, t) {
				Un.prototype[n] = function (r) {
					r = r === T ? 1 : Li(Au(r), 0);
					var e = this.__filtered__ && !t ? new Un(this) : this.clone();
					return e.__filtered__ ? e.__takeCount__ = Ui(r, e.__takeCount__) : e.__views__.push({
						size: Ui(r, 4294967295),
						type: n + (0 > e.__dir__ ? "Right" : "")
					}), e
				}, Un.prototype[n + "Right"] = function (t) {
					return this.reverse()[n](t).reverse()
				}
			}), r(["filter", "map", "takeWhile"], function (n, t) {
				var r = t + 1,
					e = 1 == r || 3 == r;
				Un.prototype[n] = function (n) {
					var t = this.clone();
					return t.__iteratees__.push({
						iteratee: ye(n, 3),
						type: r
					}), t.__filtered__ = t.__filtered__ || e, t
				}
			}), r(["head", "last"], function (n, t) {
				var r = "take" + (t ? "Right" : "");
				Un.prototype[n] = function () {
					return this[r](1).value()[0]
				}
			}), r(["initial", "tail"], function (n, t) {
				var r = "drop" + (t ? "" : "Right");
				Un.prototype[n] = function () {
					return this.__filtered__ ? new Un(this) : this[r](1)
				}
			}), Un.prototype.compact = function () {
				return this.filter(Tu)
			}, Un.prototype.find = function (n) {
				return this.filter(n).head()
			}, Un.prototype.findLast = function (n) {
				return this.reverse().find(n);
			}, Un.prototype.invokeMap = fr(function (n, t) {
				return typeof n == "function" ? new Un(this) : this.map(function (r) {
					return Lt(r, n, t)
				})
			}), Un.prototype.reject = function (n) {
				return this.filter(cu(ye(n)))
			}, Un.prototype.slice = function (n, t) {
				n = Au(n);
				var r = this;
				return r.__filtered__ && (0 < n || 0 > t) ? new Un(r) : (0 > n ? r = r.takeRight(-n) : n && (r = r.drop(n)), t !== T && (t = Au(t), r = 0 > t ? r.dropRight(-t) : r.take(t - n)), r)
			}, Un.prototype.takeRightWhile = function (n) {
				return this.reverse().takeWhile(n).reverse()
			}, Un.prototype.toArray = function () {
				return this.take(4294967295);
			}, mt(Un.prototype, function (n, t) {
				var r = /^(?:filter|find|map|reject)|While$/.test(t),
					e = /^(?:head|last)$/.test(t),
					u = An[e ? "take" + ("last" == t ? "Right" : "") : t],
					i = e || /^find/.test(t);
				u && (An.prototype[t] = function () {
					function t(n) {
						return n = u.apply(An, a([n], f)), e && h ? n[0] : n
					}
					var o = this.__wrapped__,
						f = e ? [1] : arguments,
						c = o instanceof Un,
						l = f[0],
						s = c || of (o);
					s && r && typeof l == "function" && 1 != l.length && (c = s = false);
					var h = this.__chain__,
						p = !!this.__actions__.length,
						l = i && !h,
						c = c && !p;
					return !i && s ? (o = c ? o : new Un(this), o = n.apply(o, f), o.__actions__.push({
						func: Ye,
						args: [t],
						thisArg: T
					}), new On(o, h)) : l && c ? n.apply(this, f) : (o = this.thru(t), l ? e ? o.value()[0] : o.value() : o)
				})
			}), r("pop push shift sort splice unshift".split(" "), function (n) {
				var t = ti[n],
					r = /^(?:push|sort|unshift)$/.test(n) ? "tap" : "thru",
					e = /^(?:pop|shift)$/.test(n);
				An.prototype[n] = function () {
					var n = arguments;
					if (e && !this.__chain__) {
						var u = this.value();
						return t.apply( of (u) ? u : [], n)
					}
					return this[r](function (r) {
						return t.apply( of (r) ? r : [], n)
					})
				}
			}), mt(Un.prototype, function (n, t) {
				var r = An[t];
				if (r) {
					var e = r.name + "";
					(Ki[e] || (Ki[e] = [])).push({
						name: t,
						func: r
					})
				}
			}), Ki[Jr(T, 2).name] = [{
				name: "wrapper",
				func: T
			}], Un.prototype.clone = function () {
				var n = new Un(this.__wrapped__);
				return n.__actions__ = Ur(this.__actions__), n.__dir__ = this.__dir__, n.__filtered__ = this.__filtered__, n.__iteratees__ = Ur(this.__iteratees__), n.__takeCount__ = this.__takeCount__, n.__views__ = Ur(this.__views__), n
			}, Un.prototype.reverse = function () {
				if (this.__filtered__) {
					var n = new Un(this);
					n.__dir__ = -1, n.__filtered__ = true
				} else n = this.clone(), n.__dir__ *= -1;
				return n;
			}, Un.prototype.value = function () {
				var n, t = this.__wrapped__.value(),
					r = this.__dir__,
					e = of (t),
					u = 0 > r,
					i = e ? t.length : 0;
				n = i;
				for (var o = this.__views__, f = 0, c = -1, a = o.length; ++c < a;) {
					var l = o[c],
						s = l.size;
					switch (l.type) {
						case "drop":
							f += s;
							break;
						case "dropRight":
							n -= s;
							break;
						case "take":
							n = Ui(n, f + s);
							break;
						case "takeRight":
							f = Li(f, n - s)
					}
				}
				if (n = {
						start: f,
						end: n
					}, o = n.start, f = n.end, n = f - o, o = u ? f : o - 1, f = this.__iteratees__, c = f.length, a = 0, l = Ui(n, this.__takeCount__), !e || !u && i == n && l == n) return wr(t, this.__actions__);
				e = [];
				n: for (; n-- && a < l;) {
					for (o += r, u = -1, i = t[o]; ++u < c;) {
						var h = f[u],
							s = h.type,
							h = (0, h.iteratee)(i);
						if (2 == s) i = h;
						else if (!h) {
							if (1 == s) continue n;
							break n
						}
					}
					e[a++] = i
				}
				return e
			}, An.prototype.at = Mo, An.prototype.chain = function () {
				return Je(this)
			}, An.prototype.commit = function () {
				return new On(this.value(), this.__chain__)
			}, An.prototype.next = function () {
				this.__values__ === T && (this.__values__ = wu(this.value()));
				var n = this.__index__ >= this.__values__.length;
				return {
					done: n,
					value: n ? T : this.__values__[this.__index__++]
				}
			}, An.prototype.plant = function (n) {
				for (var t, r = this; r instanceof kn;) {
					var e = $e(r);
					e.__index__ = 0, e.__values__ = T, t ? u.__wrapped__ = e : t = e;
					var u = e,
						r = r.__wrapped__
				}
				return u.__wrapped__ = n, t
			}, An.prototype.reverse = function () {
				var n = this.__wrapped__;
				return n instanceof Un ? (this.__actions__.length && (n = new Un(this)), n = n.reverse(), n.__actions__.push({
					func: Ye,
					args: [Ke],
					thisArg: T
				}), new On(n, this.__chain__)) : this.thru(Ke)
			}, An.prototype.toJSON = An.prototype.valueOf = An.prototype.value = function () {
				return wr(this.__wrapped__, this.__actions__)
			}, An.prototype.first = An.prototype.head, ji && (An.prototype[ji] = Qe), An
		}();
	typeof define == "function" && typeof define.amd == "object" && define.amd ? (Fn._ = rt, define(function () {
		return rt
	})) : Pn ? ((Pn.exports = rt)._ = rt, Nn._ = rt) : Fn._ = rt
}).call(this);; /* axios v0.17.1 | (c) 2017 by Matt Zabriskie */
! function (e, t) {
	"object" == typeof exports && "object" == typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : "object" == typeof exports ? exports.axios = t() : e.axios = t()
}(this, function () {
	return function (e) {
		function t(r) {
			if (n[r]) return n[r].exports;
			var o = n[r] = {
				exports: {},
				id: r,
				loaded: !1
			};
			return e[r].call(o.exports, o, o.exports, t), o.loaded = !0, o.exports
		}
		var n = {};
		return t.m = e, t.c = n, t.p = "", t(0)
	}([function (e, t, n) {
		e.exports = n(1)
	}, function (e, t, n) {
		"use strict";

		function r(e) {
			var t = new s(e),
				n = i(s.prototype.request, t);
			return o.extend(n, s.prototype, t), o.extend(n, t), n
		}
		var o = n(2),
			i = n(3),
			s = n(5),
			u = n(6),
			a = r(u);
		a.Axios = s, a.create = function (e) {
			return r(o.merge(u, e))
		}, a.Cancel = n(23), a.CancelToken = n(24), a.isCancel = n(20), a.all = function (e) {
			return Promise.all(e)
		}, a.spread = n(25), e.exports = a, e.exports.default = a
	}, function (e, t, n) {
		"use strict";

		function r(e) {
			return "[object Array]" === R.call(e)
		}

		function o(e) {
			return "[object ArrayBuffer]" === R.call(e)
		}

		function i(e) {
			return "undefined" != typeof FormData && e instanceof FormData
		}

		function s(e) {
			var t;
			return t = "undefined" != typeof ArrayBuffer && ArrayBuffer.isView ? ArrayBuffer.isView(e) : e && e.buffer && e.buffer instanceof ArrayBuffer
		}

		function u(e) {
			return "string" == typeof e
		}

		function a(e) {
			return "number" == typeof e
		}

		function c(e) {
			return "undefined" == typeof e
		}

		function f(e) {
			return null !== e && "object" == typeof e
		}

		function p(e) {
			return "[object Date]" === R.call(e)
		}

		function d(e) {
			return "[object File]" === R.call(e)
		}

		function l(e) {
			return "[object Blob]" === R.call(e)
		}

		function h(e) {
			return "[object Function]" === R.call(e)
		}

		function m(e) {
			return f(e) && h(e.pipe)
		}

		function y(e) {
			return "undefined" != typeof URLSearchParams && e instanceof URLSearchParams
		}

		function w(e) {
			return e.replace(/^\s*/, "").replace(/\s*$/, "")
		}

		function g() {
			return ("undefined" == typeof navigator || "ReactNative" !== navigator.product) && ("undefined" != typeof window && "undefined" != typeof document)
		}

		function v(e, t) {
			if (null !== e && "undefined" != typeof e)
				if ("object" != typeof e && (e = [e]), r(e))
					for (var n = 0, o = e.length; n < o; n++) t.call(null, e[n], n, e);
				else
					for (var i in e) Object.prototype.hasOwnProperty.call(e, i) && t.call(null, e[i], i, e)
		}

		function x() {
			function e(e, n) {
				"object" == typeof t[n] && "object" == typeof e ? t[n] = x(t[n], e) : t[n] = e
			}
			for (var t = {}, n = 0, r = arguments.length; n < r; n++) v(arguments[n], e);
			return t
		}

		function b(e, t, n) {
			return v(t, function (t, r) {
				n && "function" == typeof t ? e[r] = E(t, n) : e[r] = t
			}), e
		}
		var E = n(3),
			C = n(4),
			R = Object.prototype.toString;
		e.exports = {
			isArray: r,
			isArrayBuffer: o,
			isBuffer: C,
			isFormData: i,
			isArrayBufferView: s,
			isString: u,
			isNumber: a,
			isObject: f,
			isUndefined: c,
			isDate: p,
			isFile: d,
			isBlob: l,
			isFunction: h,
			isStream: m,
			isURLSearchParams: y,
			isStandardBrowserEnv: g,
			forEach: v,
			merge: x,
			extend: b,
			trim: w
		}
	}, function (e, t) {
		"use strict";
		e.exports = function (e, t) {
			return function () {
				for (var n = new Array(arguments.length), r = 0; r < n.length; r++) n[r] = arguments[r];
				return e.apply(t, n)
			}
		}
	}, function (e, t) {
		function n(e) {
			return !!e.constructor && "function" == typeof e.constructor.isBuffer && e.constructor.isBuffer(e)
		}

		function r(e) {
			return "function" == typeof e.readFloatLE && "function" == typeof e.slice && n(e.slice(0, 0))
		}
		/*!
		 * Determine if an object is a Buffer
		 *
		 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
		 * @license  MIT
		 */
		e.exports = function (e) {
			return null != e && (n(e) || r(e) || !!e._isBuffer)
		}
	}, function (e, t, n) {
		"use strict";

		function r(e) {
			this.defaults = e, this.interceptors = {
				request: new s,
				response: new s
			}
		}
		var o = n(6),
			i = n(2),
			s = n(17),
			u = n(18);
		r.prototype.request = function (e) {
			"string" == typeof e && (e = i.merge({
				url: arguments[0]
			}, arguments[1])), e = i.merge(o, this.defaults, {
				method: "get"
			}, e), e.method = e.method.toLowerCase();
			var t = [u, void 0],
				n = Promise.resolve(e);
			for (this.interceptors.request.forEach(function (e) {
					t.unshift(e.fulfilled, e.rejected)
				}), this.interceptors.response.forEach(function (e) {
					t.push(e.fulfilled, e.rejected)
				}); t.length;) n = n.then(t.shift(), t.shift());
			return n
		}, i.forEach(["delete", "get", "head", "options"], function (e) {
			r.prototype[e] = function (t, n) {
				return this.request(i.merge(n || {}, {
					method: e,
					url: t
				}))
			}
		}), i.forEach(["post", "put", "patch"], function (e) {
			r.prototype[e] = function (t, n, r) {
				return this.request(i.merge(r || {}, {
					method: e,
					url: t,
					data: n
				}))
			}
		}), e.exports = r
	}, function (e, t, n) {
		"use strict";

		function r(e, t) {
			!i.isUndefined(e) && i.isUndefined(e["Content-Type"]) && (e["Content-Type"] = t)
		}

		function o() {
			var e;
			return "undefined" != typeof XMLHttpRequest ? e = n(8) : "undefined" != typeof process && (e = n(8)), e
		}
		var i = n(2),
			s = n(7),
			u = {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			a = {
				adapter: o(),
				transformRequest: [function (e, t) {
					return s(t, "Content-Type"), i.isFormData(e) || i.isArrayBuffer(e) || i.isBuffer(e) || i.isStream(e) || i.isFile(e) || i.isBlob(e) ? e : i.isArrayBufferView(e) ? e.buffer : i.isURLSearchParams(e) ? (r(t, "application/x-www-form-urlencoded;charset=utf-8"), e.toString()) : i.isObject(e) ? (r(t, "application/json;charset=utf-8"), JSON.stringify(e)) : e
				}],
				transformResponse: [function (e) {
					if ("string" == typeof e) try {
						e = JSON.parse(e)
					} catch (e) {}
					return e
				}],
				timeout: 0,
				xsrfCookieName: "XSRF-TOKEN",
				xsrfHeaderName: "X-XSRF-TOKEN",
				maxContentLength: -1,
				validateStatus: function (e) {
					return e >= 200 && e < 300
				}
			};
		a.headers = {
			common: {
				Accept: "application/json, text/plain, */*"
			}
		}, i.forEach(["delete", "get", "head"], function (e) {
			a.headers[e] = {}
		}), i.forEach(["post", "put", "patch"], function (e) {
			a.headers[e] = i.merge(u)
		}), e.exports = a
	}, function (e, t, n) {
		"use strict";
		var r = n(2);
		e.exports = function (e, t) {
			r.forEach(e, function (n, r) {
				r !== t && r.toUpperCase() === t.toUpperCase() && (e[t] = n, delete e[r])
			})
		}
	}, function (e, t, n) {
		"use strict";
		var r = n(2),
			o = n(9),
			i = n(12),
			s = n(13),
			u = n(14),
			a = n(10),
			c = "undefined" != typeof window && window.btoa && window.btoa.bind(window) || n(15);
		e.exports = function (e) {
			return new Promise(function (t, f) {
				var p = e.data,
					d = e.headers;
				r.isFormData(p) && delete d["Content-Type"];
				var l = new XMLHttpRequest,
					h = "onreadystatechange",
					m = !1;
				if ("undefined" == typeof window || !window.XDomainRequest || "withCredentials" in l || u(e.url) || (l = new window.XDomainRequest, h = "onload", m = !0, l.onprogress = function () {}, l.ontimeout = function () {}), e.auth) {
					var y = e.auth.username || "",
						w = e.auth.password || "";
					d.Authorization = "Basic " + c(y + ":" + w)
				}
				if (l.open(e.method.toUpperCase(), i(e.url, e.params, e.paramsSerializer), !0), l.timeout = e.timeout, l[h] = function () {
						if (l && (4 === l.readyState || m) && (0 !== l.status || l.responseURL && 0 === l.responseURL.indexOf("file:"))) {
							var n = "getAllResponseHeaders" in l ? s(l.getAllResponseHeaders()) : null,
								r = e.responseType && "text" !== e.responseType ? l.response : l.responseText,
								i = {
									data: r,
									status: 1223 === l.status ? 204 : l.status,
									statusText: 1223 === l.status ? "No Content" : l.statusText,
									headers: n,
									config: e,
									request: l
								};
							o(t, f, i), l = null
						}
					}, l.onerror = function () {
						f(a("Network Error", e, null, l)), l = null
					}, l.ontimeout = function () {
						f(a("timeout of " + e.timeout + "ms exceeded", e, "ECONNABORTED", l)), l = null
					}, r.isStandardBrowserEnv()) {
					var g = n(16),
						v = (e.withCredentials || u(e.url)) && e.xsrfCookieName ? g.read(e.xsrfCookieName) : void 0;
					v && (d[e.xsrfHeaderName] = v)
				}
				if ("setRequestHeader" in l && r.forEach(d, function (e, t) {
						"undefined" == typeof p && "content-type" === t.toLowerCase() ? delete d[t] : l.setRequestHeader(t, e)
					}), e.withCredentials && (l.withCredentials = !0), e.responseType) try {
					l.responseType = e.responseType
				} catch (t) {
					if ("json" !== e.responseType) throw t
				}
				"function" == typeof e.onDownloadProgress && l.addEventListener("progress", e.onDownloadProgress), "function" == typeof e.onUploadProgress && l.upload && l.upload.addEventListener("progress", e.onUploadProgress), e.cancelToken && e.cancelToken.promise.then(function (e) {
					l && (l.abort(), f(e), l = null)
				}), void 0 === p && (p = null), l.send(p)
			})
		}
	}, function (e, t, n) {
		"use strict";
		var r = n(10);
		e.exports = function (e, t, n) {
			var o = n.config.validateStatus;
			n.status && o && !o(n.status) ? t(r("Request failed with status code " + n.status, n.config, null, n.request, n)) : e(n)
		}
	}, function (e, t, n) {
		"use strict";
		var r = n(11);
		e.exports = function (e, t, n, o, i) {
			var s = new Error(e);
			return r(s, t, n, o, i)
		}
	}, function (e, t) {
		"use strict";
		e.exports = function (e, t, n, r, o) {
			return e.config = t, n && (e.code = n), e.request = r, e.response = o, e
		}
	}, function (e, t, n) {
		"use strict";

		function r(e) {
			return encodeURIComponent(e).replace(/%40/gi, "@").replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+").replace(/%5B/gi, "[").replace(/%5D/gi, "]")
		}
		var o = n(2);
		e.exports = function (e, t, n) {
			if (!t) return e;
			var i;
			if (n) i = n(t);
			else if (o.isURLSearchParams(t)) i = t.toString();
			else {
				var s = [];
				o.forEach(t, function (e, t) {
					null !== e && "undefined" != typeof e && (o.isArray(e) && (t += "[]"), o.isArray(e) || (e = [e]), o.forEach(e, function (e) {
						o.isDate(e) ? e = e.toISOString() : o.isObject(e) && (e = JSON.stringify(e)), s.push(r(t) + "=" + r(e))
					}))
				}), i = s.join("&")
			}
			return i && (e += (e.indexOf("?") === -1 ? "?" : "&") + i), e
		}
	}, function (e, t, n) {
		"use strict";
		var r = n(2),
			o = ["age", "authorization", "content-length", "content-type", "etag", "expires", "from", "host", "if-modified-since", "if-unmodified-since", "last-modified", "location", "max-forwards", "proxy-authorization", "referer", "retry-after", "user-agent"];
		e.exports = function (e) {
			var t, n, i, s = {};
			return e ? (r.forEach(e.split("\n"), function (e) {
				if (i = e.indexOf(":"), t = r.trim(e.substr(0, i)).toLowerCase(), n = r.trim(e.substr(i + 1)), t) {
					if (s[t] && o.indexOf(t) >= 0) return;
					"set-cookie" === t ? s[t] = (s[t] ? s[t] : []).concat([n]) : s[t] = s[t] ? s[t] + ", " + n : n
				}
			}), s) : s
		}
	}, function (e, t, n) {
		"use strict";
		var r = n(2);
		e.exports = r.isStandardBrowserEnv() ? function () {
			function e(e) {
				var t = e;
				return n && (o.setAttribute("href", t), t = o.href), o.setAttribute("href", t), {
					href: o.href,
					protocol: o.protocol ? o.protocol.replace(/:$/, "") : "",
					host: o.host,
					search: o.search ? o.search.replace(/^\?/, "") : "",
					hash: o.hash ? o.hash.replace(/^#/, "") : "",
					hostname: o.hostname,
					port: o.port,
					pathname: "/" === o.pathname.charAt(0) ? o.pathname : "/" + o.pathname
				}
			}
			var t, n = /(msie|trident)/i.test(navigator.userAgent),
				o = document.createElement("a");
			return t = e(window.location.href),
				function (n) {
					var o = r.isString(n) ? e(n) : n;
					return o.protocol === t.protocol && o.host === t.host
				}
		}() : function () {
			return function () {
				return !0
			}
		}()
	}, function (e, t) {
		"use strict";

		function n() {
			this.message = "String contains an invalid character"
		}

		function r(e) {
			for (var t, r, i = String(e), s = "", u = 0, a = o; i.charAt(0 | u) || (a = "=", u % 1); s += a.charAt(63 & t >> 8 - u % 1 * 8)) {
				if (r = i.charCodeAt(u += .75), r > 255) throw new n;
				t = t << 8 | r
			}
			return s
		}
		var o = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
		n.prototype = new Error, n.prototype.code = 5, n.prototype.name = "InvalidCharacterError", e.exports = r
	}, function (e, t, n) {
		"use strict";
		var r = n(2);
		e.exports = r.isStandardBrowserEnv() ? function () {
			return {
				write: function (e, t, n, o, i, s) {
					var u = [];
					u.push(e + "=" + encodeURIComponent(t)), r.isNumber(n) && u.push("expires=" + new Date(n).toGMTString()), r.isString(o) && u.push("path=" + o), r.isString(i) && u.push("domain=" + i), s === !0 && u.push("secure"), document.cookie = u.join("; ")
				},
				read: function (e) {
					var t = document.cookie.match(new RegExp("(^|;\\s*)(" + e + ")=([^;]*)"));
					return t ? decodeURIComponent(t[3]) : null
				},
				remove: function (e) {
					this.write(e, "", Date.now() - 864e5)
				}
			}
		}() : function () {
			return {
				write: function () {},
				read: function () {
					return null
				},
				remove: function () {}
			}
		}()
	}, function (e, t, n) {
		"use strict";

		function r() {
			this.handlers = []
		}
		var o = n(2);
		r.prototype.use = function (e, t) {
			return this.handlers.push({
				fulfilled: e,
				rejected: t
			}), this.handlers.length - 1
		}, r.prototype.eject = function (e) {
			this.handlers[e] && (this.handlers[e] = null)
		}, r.prototype.forEach = function (e) {
			o.forEach(this.handlers, function (t) {
				null !== t && e(t)
			})
		}, e.exports = r
	}, function (e, t, n) {
		"use strict";

		function r(e) {
			e.cancelToken && e.cancelToken.throwIfRequested()
		}
		var o = n(2),
			i = n(19),
			s = n(20),
			u = n(6),
			a = n(21),
			c = n(22);
		e.exports = function (e) {
			r(e), e.baseURL && !a(e.url) && (e.url = c(e.baseURL, e.url)), e.headers = e.headers || {}, e.data = i(e.data, e.headers, e.transformRequest), e.headers = o.merge(e.headers.common || {}, e.headers[e.method] || {}, e.headers || {}), o.forEach(["delete", "get", "head", "post", "put", "patch", "common"], function (t) {
				delete e.headers[t]
			});
			var t = e.adapter || u.adapter;
			return t(e).then(function (t) {
				return r(e), t.data = i(t.data, t.headers, e.transformResponse), t
			}, function (t) {
				return s(t) || (r(e), t && t.response && (t.response.data = i(t.response.data, t.response.headers, e.transformResponse))), Promise.reject(t)
			})
		}
	}, function (e, t, n) {
		"use strict";
		var r = n(2);
		e.exports = function (e, t, n) {
			return r.forEach(n, function (n) {
				e = n(e, t)
			}), e
		}
	}, function (e, t) {
		"use strict";
		e.exports = function (e) {
			return !(!e || !e.__CANCEL__)
		}
	}, function (e, t) {
		"use strict";
		e.exports = function (e) {
			return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(e)
		}
	}, function (e, t) {
		"use strict";
		e.exports = function (e, t) {
			return t ? e.replace(/\/+$/, "") + "/" + t.replace(/^\/+/, "") : e
		}
	}, function (e, t) {
		"use strict";

		function n(e) {
			this.message = e
		}
		n.prototype.toString = function () {
			return "Cancel" + (this.message ? ": " + this.message : "")
		}, n.prototype.__CANCEL__ = !0, e.exports = n
	}, function (e, t, n) {
		"use strict";

		function r(e) {
			if ("function" != typeof e) throw new TypeError("executor must be a function.");
			var t;
			this.promise = new Promise(function (e) {
				t = e
			});
			var n = this;
			e(function (e) {
				n.reason || (n.reason = new o(e), t(n.reason))
			})
		}
		var o = n(23);
		r.prototype.throwIfRequested = function () {
			if (this.reason) throw this.reason
		}, r.source = function () {
			var e, t = new r(function (t) {
				e = t
			});
			return {
				token: t,
				cancel: e
			}
		}, e.exports = r
	}, function (e, t) {
		"use strict";
		e.exports = function (e) {
			return function (t) {
				return e.apply(null, t)
			}
		}
	}])
});
//# sourceMappingURL=axios.min.map
! function (e) {
	var n = !1;
	if ("function" == typeof define && define.amd && (define(e), n = !0), "object" == typeof exports && (module.exports = e(), n = !0), !n) {
		var o = window.Cookies,
			t = window.Cookies = e();
		t.noConflict = function () {
			return window.Cookies = o, t
		}
	}
}(function () {
	function e() {
		for (var e = 0, n = {}; e < arguments.length; e++) {
			var o = arguments[e];
			for (var t in o) n[t] = o[t]
		}
		return n
	}

	function n(o) {
		function t(n, r, i) {
			var c;
			if ("undefined" != typeof document) {
				if (arguments.length > 1) {
					if ("number" == typeof (i = e({
							path: "/"
						}, t.defaults, i)).expires) {
						var a = new Date;
						a.setMilliseconds(a.getMilliseconds() + 864e5 * i.expires), i.expires = a
					}
					i.expires = i.expires ? i.expires.toUTCString() : "";
					try {
						c = JSON.stringify(r), /^[\{\[]/.test(c) && (r = c)
					} catch (e) {}
					r = o.write ? o.write(r, n) : encodeURIComponent(r + "").replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent), n = (n = (n = encodeURIComponent(n + "")).replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent)).replace(/[\(\)]/g, escape);
					var s = "";
					for (var f in i) i[f] && (s += "; " + f, !0 !== i[f] && (s += "=" + i[f]));
					return document.cookie = n + "=" + r + s
				}
				n || (c = {});
				for (var p = document.cookie ? document.cookie.split("; ") : [], d = /(%[0-9A-Z]{2})+/g, u = 0; u < p.length; u++) {
					var l = p[u].split("="),
						C = l.slice(1).join("=");
					this.json || '"' !== C.charAt(0) || (C = C.slice(1, -1));
					try {
						var m = l[0].replace(d, decodeURIComponent);
						if (C = o.read ? o.read(C, m) : o(C, m) || C.replace(d, decodeURIComponent), this.json) try {
							C = JSON.parse(C)
						} catch (e) {}
						if (n === m) {
							c = C;
							break
						}
						n || (c[m] = C)
					} catch (e) {}
				}
				return c
			}
		}
		return t.set = t, t.get = function (e) {
			return t.call(t, e)
		}, t.getJSON = function () {
			return t.apply({
				json: !0
			}, [].slice.call(arguments))
		}, t.defaults = {}, t.remove = function (n, o) {
			t(n, "", e(o, {
				expires: -1
			}))
		}, t.withConverter = n, t
	}
	return n(function () {})
});;
! function (e, t) {
	"object" == typeof exports && "undefined" != typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define(t) : e.Swiper = t()
}(this, function () {
	"use strict";
	var e = "undefined" == typeof document ? {
			body: {},
			addEventListener: function () {},
			removeEventListener: function () {},
			activeElement: {
				blur: function () {},
				nodeName: ""
			},
			querySelector: function () {
				return null
			},
			querySelectorAll: function () {
				return []
			},
			getElementById: function () {
				return null
			},
			createEvent: function () {
				return {
					initEvent: function () {}
				}
			},
			createElement: function () {
				return {
					children: [],
					childNodes: [],
					style: {},
					setAttribute: function () {},
					getElementsByTagName: function () {
						return []
					}
				}
			},
			location: {
				hash: ""
			}
		} : document,
		t = "undefined" == typeof window ? {
			document: e,
			navigator: {
				userAgent: ""
			},
			location: {},
			history: {},
			CustomEvent: function () {
				return this
			},
			addEventListener: function () {},
			removeEventListener: function () {},
			getComputedStyle: function () {
				return {
					getPropertyValue: function () {
						return ""
					}
				}
			},
			Image: function () {},
			Date: function () {},
			screen: {},
			setTimeout: function () {},
			clearTimeout: function () {}
		} : window,
		i = function (e) {
			for (var t = 0; t < e.length; t += 1) this[t] = e[t];
			return this.length = e.length, this
		};

	function s(s, a) {
		var r = [],
			n = 0;
		if (s && !a && s instanceof i) return s;
		if (s)
			if ("string" == typeof s) {
				var o, l, d = s.trim();
				if (d.indexOf("<") >= 0 && d.indexOf(">") >= 0) {
					var h = "div";
					for (0 === d.indexOf("<li") && (h = "ul"), 0 === d.indexOf("<tr") && (h = "tbody"), 0 !== d.indexOf("<td") && 0 !== d.indexOf("<th") || (h = "tr"), 0 === d.indexOf("<tbody") && (h = "table"), 0 === d.indexOf("<option") && (h = "select"), (l = e.createElement(h)).innerHTML = d, n = 0; n < l.childNodes.length; n += 1) r.push(l.childNodes[n])
				} else
					for (o = a || "#" !== s[0] || s.match(/[ .<>:~]/) ? (a || e).querySelectorAll(s.trim()) : [e.getElementById(s.trim().split("#")[1])], n = 0; n < o.length; n += 1) o[n] && r.push(o[n])
			} else if (s.nodeType || s === t || s === e) r.push(s);
		else if (s.length > 0 && s[0].nodeType)
			for (n = 0; n < s.length; n += 1) r.push(s[n]);
		return new i(r)
	}

	function a(e) {
		for (var t = [], i = 0; i < e.length; i += 1) - 1 === t.indexOf(e[i]) && t.push(e[i]);
		return t
	}
	s.fn = i.prototype, s.Class = i, s.Dom7 = i;
	"resize scroll".split(" ");
	var r = {
		addClass: function (e) {
			if (void 0 === e) return this;
			for (var t = e.split(" "), i = 0; i < t.length; i += 1)
				for (var s = 0; s < this.length; s += 1) void 0 !== this[s].classList && this[s].classList.add(t[i]);
			return this
		},
		removeClass: function (e) {
			for (var t = e.split(" "), i = 0; i < t.length; i += 1)
				for (var s = 0; s < this.length; s += 1) void 0 !== this[s].classList && this[s].classList.remove(t[i]);
			return this
		},
		hasClass: function (e) {
			return !!this[0] && this[0].classList.contains(e)
		},
		toggleClass: function (e) {
			for (var t = e.split(" "), i = 0; i < t.length; i += 1)
				for (var s = 0; s < this.length; s += 1) void 0 !== this[s].classList && this[s].classList.toggle(t[i]);
			return this
		},
		attr: function (e, t) {
			var i = arguments;
			if (1 === arguments.length && "string" == typeof e) return this[0] ? this[0].getAttribute(e) : void 0;
			for (var s = 0; s < this.length; s += 1)
				if (2 === i.length) this[s].setAttribute(e, t);
				else
					for (var a in e) this[s][a] = e[a], this[s].setAttribute(a, e[a]);
			return this
		},
		removeAttr: function (e) {
			for (var t = 0; t < this.length; t += 1) this[t].removeAttribute(e);
			return this
		},
		data: function (e, t) {
			var i;
			if (void 0 !== t) {
				for (var s = 0; s < this.length; s += 1)(i = this[s]).dom7ElementDataStorage || (i.dom7ElementDataStorage = {}), i.dom7ElementDataStorage[e] = t;
				return this
			}
			if (i = this[0]) {
				if (i.dom7ElementDataStorage && e in i.dom7ElementDataStorage) return i.dom7ElementDataStorage[e];
				var a = i.getAttribute("data-" + e);
				return a || void 0
			}
		},
		transform: function (e) {
			for (var t = 0; t < this.length; t += 1) {
				var i = this[t].style;
				i.webkitTransform = e, i.transform = e
			}
			return this
		},
		transition: function (e) {
			"string" != typeof e && (e += "ms");
			for (var t = 0; t < this.length; t += 1) {
				var i = this[t].style;
				i.webkitTransitionDuration = e, i.transitionDuration = e
			}
			return this
		},
		on: function () {
			for (var e = [], t = arguments.length; t--;) e[t] = arguments[t];
			var i, a = e[0],
				r = e[1],
				n = e[2],
				o = e[3];

			function l(e) {
				var t = e.target;
				if (t) {
					var i = e.target.dom7EventData || [];
					if (i.unshift(e), s(t).is(r)) n.apply(t, i);
					else
						for (var a = s(t).parents(), o = 0; o < a.length; o += 1) s(a[o]).is(r) && n.apply(a[o], i)
				}
			}

			function d(e) {
				var t = e && e.target ? e.target.dom7EventData || [] : [];
				t.unshift(e), n.apply(this, t)
			}
			"function" == typeof e[1] && (a = (i = e)[0], n = i[1], o = i[2], r = void 0), o || (o = !1);
			for (var h, p = a.split(" "), c = 0; c < this.length; c += 1) {
				var u = this[c];
				if (r)
					for (h = 0; h < p.length; h += 1) u.dom7LiveListeners || (u.dom7LiveListeners = []), u.dom7LiveListeners.push({
						type: a,
						listener: n,
						proxyListener: l
					}), u.addEventListener(p[h], l, o);
				else
					for (h = 0; h < p.length; h += 1) u.dom7Listeners || (u.dom7Listeners = []), u.dom7Listeners.push({
						type: a,
						listener: n,
						proxyListener: d
					}), u.addEventListener(p[h], d, o)
			}
			return this
		},
		off: function () {
			for (var e = [], t = arguments.length; t--;) e[t] = arguments[t];
			var i, s = e[0],
				a = e[1],
				r = e[2],
				n = e[3];
			"function" == typeof e[1] && (s = (i = e)[0], r = i[1], n = i[2], a = void 0), n || (n = !1);
			for (var o = s.split(" "), l = 0; l < o.length; l += 1)
				for (var d = 0; d < this.length; d += 1) {
					var h = this[d];
					if (a) {
						if (h.dom7LiveListeners)
							for (var p = 0; p < h.dom7LiveListeners.length; p += 1) r ? h.dom7LiveListeners[p].listener === r && h.removeEventListener(o[l], h.dom7LiveListeners[p].proxyListener, n) : h.dom7LiveListeners[p].type === o[l] && h.removeEventListener(o[l], h.dom7LiveListeners[p].proxyListener, n)
					} else if (h.dom7Listeners)
						for (var c = 0; c < h.dom7Listeners.length; c += 1) r ? h.dom7Listeners[c].listener === r && h.removeEventListener(o[l], h.dom7Listeners[c].proxyListener, n) : h.dom7Listeners[c].type === o[l] && h.removeEventListener(o[l], h.dom7Listeners[c].proxyListener, n)
				}
			return this
		},
		trigger: function () {
			for (var i = [], s = arguments.length; s--;) i[s] = arguments[s];
			for (var a = i[0].split(" "), r = i[1], n = 0; n < a.length; n += 1)
				for (var o = 0; o < this.length; o += 1) {
					var l = void 0;
					try {
						l = new t.CustomEvent(a[n], {
							detail: r,
							bubbles: !0,
							cancelable: !0
						})
					} catch (t) {
						(l = e.createEvent("Event")).initEvent(a[n], !0, !0), l.detail = r
					}
					this[o].dom7EventData = i.filter(function (e, t) {
						return t > 0
					}), this[o].dispatchEvent(l), this[o].dom7EventData = [], delete this[o].dom7EventData
				}
			return this
		},
		transitionEnd: function (e) {
			var t, i = ["webkitTransitionEnd", "transitionend"],
				s = this;

			function a(r) {
				if (r.target === this)
					for (e.call(this, r), t = 0; t < i.length; t += 1) s.off(i[t], a)
			}
			if (e)
				for (t = 0; t < i.length; t += 1) s.on(i[t], a);
			return this
		},
		outerWidth: function (e) {
			if (this.length > 0) {
				if (e) {
					var t = this.styles();
					return this[0].offsetWidth + parseFloat(t.getPropertyValue("margin-right")) + parseFloat(t.getPropertyValue("margin-left"))
				}
				return this[0].offsetWidth
			}
			return null
		},
		outerHeight: function (e) {
			if (this.length > 0) {
				if (e) {
					var t = this.styles();
					return this[0].offsetHeight + parseFloat(t.getPropertyValue("margin-top")) + parseFloat(t.getPropertyValue("margin-bottom"))
				}
				return this[0].offsetHeight
			}
			return null
		},
		offset: function () {
			if (this.length > 0) {
				var i = this[0],
					s = i.getBoundingClientRect(),
					a = e.body,
					r = i.clientTop || a.clientTop || 0,
					n = i.clientLeft || a.clientLeft || 0,
					o = i === t ? t.scrollY : i.scrollTop,
					l = i === t ? t.scrollX : i.scrollLeft;
				return {
					top: s.top + o - r,
					left: s.left + l - n
				}
			}
			return null
		},
		css: function (e, i) {
			var s;
			if (1 === arguments.length) {
				if ("string" != typeof e) {
					for (s = 0; s < this.length; s += 1)
						for (var a in e) this[s].style[a] = e[a];
					return this
				}
				if (this[0]) return t.getComputedStyle(this[0], null).getPropertyValue(e)
			}
			if (2 === arguments.length && "string" == typeof e) {
				for (s = 0; s < this.length; s += 1) this[s].style[e] = i;
				return this
			}
			return this
		},
		each: function (e) {
			if (!e) return this;
			for (var t = 0; t < this.length; t += 1)
				if (!1 === e.call(this[t], t, this[t])) return this;
			return this
		},
		html: function (e) {
			if (void 0 === e) return this[0] ? this[0].innerHTML : void 0;
			for (var t = 0; t < this.length; t += 1) this[t].innerHTML = e;
			return this
		},
		text: function (e) {
			if (void 0 === e) return this[0] ? this[0].textContent.trim() : null;
			for (var t = 0; t < this.length; t += 1) this[t].textContent = e;
			return this
		},
		is: function (a) {
			var r, n, o = this[0];
			if (!o || void 0 === a) return !1;
			if ("string" == typeof a) {
				if (o.matches) return o.matches(a);
				if (o.webkitMatchesSelector) return o.webkitMatchesSelector(a);
				if (o.msMatchesSelector) return o.msMatchesSelector(a);
				for (r = s(a), n = 0; n < r.length; n += 1)
					if (r[n] === o) return !0;
				return !1
			}
			if (a === e) return o === e;
			if (a === t) return o === t;
			if (a.nodeType || a instanceof i) {
				for (r = a.nodeType ? [a] : a, n = 0; n < r.length; n += 1)
					if (r[n] === o) return !0;
				return !1
			}
			return !1
		},
		index: function () {
			var e, t = this[0];
			if (t) {
				for (e = 0; null !== (t = t.previousSibling);) 1 === t.nodeType && (e += 1);
				return e
			}
		},
		eq: function (e) {
			if (void 0 === e) return this;
			var t, s = this.length;
			return new i(e > s - 1 ? [] : e < 0 ? (t = s + e) < 0 ? [] : [this[t]] : [this[e]])
		},
		append: function () {
			for (var t, s = [], a = arguments.length; a--;) s[a] = arguments[a];
			for (var r = 0; r < s.length; r += 1) {
				t = s[r];
				for (var n = 0; n < this.length; n += 1)
					if ("string" == typeof t) {
						var o = e.createElement("div");
						for (o.innerHTML = t; o.firstChild;) this[n].appendChild(o.firstChild)
					} else if (t instanceof i)
					for (var l = 0; l < t.length; l += 1) this[n].appendChild(t[l]);
				else this[n].appendChild(t)
			}
			return this
		},
		prepend: function (t) {
			var s, a;
			for (s = 0; s < this.length; s += 1)
				if ("string" == typeof t) {
					var r = e.createElement("div");
					for (r.innerHTML = t, a = r.childNodes.length - 1; a >= 0; a -= 1) this[s].insertBefore(r.childNodes[a], this[s].childNodes[0])
				} else if (t instanceof i)
				for (a = 0; a < t.length; a += 1) this[s].insertBefore(t[a], this[s].childNodes[0]);
			else this[s].insertBefore(t, this[s].childNodes[0]);
			return this
		},
		next: function (e) {
			return this.length > 0 ? e ? this[0].nextElementSibling && s(this[0].nextElementSibling).is(e) ? new i([this[0].nextElementSibling]) : new i([]) : this[0].nextElementSibling ? new i([this[0].nextElementSibling]) : new i([]) : new i([])
		},
		nextAll: function (e) {
			var t = [],
				a = this[0];
			if (!a) return new i([]);
			for (; a.nextElementSibling;) {
				var r = a.nextElementSibling;
				e ? s(r).is(e) && t.push(r) : t.push(r), a = r
			}
			return new i(t)
		},
		prev: function (e) {
			if (this.length > 0) {
				var t = this[0];
				return e ? t.previousElementSibling && s(t.previousElementSibling).is(e) ? new i([t.previousElementSibling]) : new i([]) : t.previousElementSibling ? new i([t.previousElementSibling]) : new i([])
			}
			return new i([])
		},
		prevAll: function (e) {
			var t = [],
				a = this[0];
			if (!a) return new i([]);
			for (; a.previousElementSibling;) {
				var r = a.previousElementSibling;
				e ? s(r).is(e) && t.push(r) : t.push(r), a = r
			}
			return new i(t)
		},
		parent: function (e) {
			for (var t = [], i = 0; i < this.length; i += 1) null !== this[i].parentNode && (e ? s(this[i].parentNode).is(e) && t.push(this[i].parentNode) : t.push(this[i].parentNode));
			return s(a(t))
		},
		parents: function (e) {
			for (var t = [], i = 0; i < this.length; i += 1)
				for (var r = this[i].parentNode; r;) e ? s(r).is(e) && t.push(r) : t.push(r), r = r.parentNode;
			return s(a(t))
		},
		closest: function (e) {
			var t = this;
			return void 0 === e ? new i([]) : (t.is(e) || (t = t.parents(e).eq(0)), t)
		},
		find: function (e) {
			for (var t = [], s = 0; s < this.length; s += 1)
				for (var a = this[s].querySelectorAll(e), r = 0; r < a.length; r += 1) t.push(a[r]);
			return new i(t)
		},
		children: function (e) {
			for (var t = [], r = 0; r < this.length; r += 1)
				for (var n = this[r].childNodes, o = 0; o < n.length; o += 1) e ? 1 === n[o].nodeType && s(n[o]).is(e) && t.push(n[o]) : 1 === n[o].nodeType && t.push(n[o]);
			return new i(a(t))
		},
		remove: function () {
			for (var e = 0; e < this.length; e += 1) this[e].parentNode && this[e].parentNode.removeChild(this[e]);
			return this
		},
		add: function () {
			for (var e = [], t = arguments.length; t--;) e[t] = arguments[t];
			var i, a;
			for (i = 0; i < e.length; i += 1) {
				var r = s(e[i]);
				for (a = 0; a < r.length; a += 1) this[this.length] = r[a], this.length += 1
			}
			return this
		},
		styles: function () {
			return this[0] ? t.getComputedStyle(this[0], null) : {}
		}
	};
	Object.keys(r).forEach(function (e) {
		s.fn[e] = r[e]
	});
	var n, o, l, d = {
			deleteProps: function (e) {
				var t = e;
				Object.keys(t).forEach(function (e) {
					try {
						t[e] = null
					} catch (e) {}
					try {
						delete t[e]
					} catch (e) {}
				})
			},
			nextTick: function (e, t) {
				return void 0 === t && (t = 0), setTimeout(e, t)
			},
			now: function () {
				return Date.now()
			},
			getTranslate: function (e, i) {
				var s, a, r;
				void 0 === i && (i = "x");
				var n = t.getComputedStyle(e, null);
				return t.WebKitCSSMatrix ? ((a = n.transform || n.webkitTransform).split(",").length > 6 && (a = a.split(", ").map(function (e) {
					return e.replace(",", ".")
				}).join(", ")), r = new t.WebKitCSSMatrix("none" === a ? "" : a)) : s = (r = n.MozTransform || n.OTransform || n.MsTransform || n.msTransform || n.transform || n.getPropertyValue("transform").replace("translate(", "matrix(1, 0, 0, 1,")).toString().split(","), "x" === i && (a = t.WebKitCSSMatrix ? r.m41 : 16 === s.length ? parseFloat(s[12]) : parseFloat(s[4])), "y" === i && (a = t.WebKitCSSMatrix ? r.m42 : 16 === s.length ? parseFloat(s[13]) : parseFloat(s[5])), a || 0
			},
			parseUrlQuery: function (e) {
				var i, s, a, r, n = {},
					o = e || t.location.href;
				if ("string" == typeof o && o.length)
					for (r = (s = (o = o.indexOf("?") > -1 ? o.replace(/\S*\?/, "") : "").split("&").filter(function (e) {
							return "" !== e
						})).length, i = 0; i < r; i += 1) a = s[i].replace(/#\S+/g, "").split("="), n[decodeURIComponent(a[0])] = void 0 === a[1] ? void 0 : decodeURIComponent(a[1]) || "";
				return n
			},
			isObject: function (e) {
				return "object" == typeof e && null !== e && e.constructor && e.constructor === Object
			},
			extend: function () {
				for (var e = [], t = arguments.length; t--;) e[t] = arguments[t];
				for (var i = Object(e[0]), s = 1; s < e.length; s += 1) {
					var a = e[s];
					if (void 0 !== a && null !== a)
						for (var r = Object.keys(Object(a)), n = 0, o = r.length; n < o; n += 1) {
							var l = r[n],
								h = Object.getOwnPropertyDescriptor(a, l);
							void 0 !== h && h.enumerable && (d.isObject(i[l]) && d.isObject(a[l]) ? d.extend(i[l], a[l]) : !d.isObject(i[l]) && d.isObject(a[l]) ? (i[l] = {}, d.extend(i[l], a[l])) : i[l] = a[l])
						}
				}
				return i
			}
		},
		h = (l = e.createElement("div"), {
			touch: t.Modernizr && !0 === t.Modernizr.touch || !!("ontouchstart" in t || t.DocumentTouch && e instanceof t.DocumentTouch),
			pointerEvents: !(!t.navigator.pointerEnabled && !t.PointerEvent),
			prefixedPointerEvents: !!t.navigator.msPointerEnabled,
			transition: (o = l.style, "transition" in o || "webkitTransition" in o || "MozTransition" in o),
			transforms3d: t.Modernizr && !0 === t.Modernizr.csstransforms3d || (n = l.style, "webkitPerspective" in n || "MozPerspective" in n || "OPerspective" in n || "MsPerspective" in n || "perspective" in n),
			flexbox: function () {
				for (var e = l.style, t = "alignItems webkitAlignItems webkitBoxAlign msFlexAlign mozBoxAlign webkitFlexDirection msFlexDirection mozBoxDirection mozBoxOrient webkitBoxDirection webkitBoxOrient".split(" "), i = 0; i < t.length; i += 1)
					if (t[i] in e) return !0;
				return !1
			}(),
			observer: "MutationObserver" in t || "WebkitMutationObserver" in t,
			passiveListener: function () {
				var e = !1;
				try {
					var i = Object.defineProperty({}, "passive", {
						get: function () {
							e = !0
						}
					});
					t.addEventListener("testPassiveListener", null, i)
				} catch (e) {}
				return e
			}(),
			gestures: "ongesturestart" in t
		}),
		p = function (e) {
			void 0 === e && (e = {});
			var t = this;
			t.params = e, t.eventsListeners = {}, t.params && t.params.on && Object.keys(t.params.on).forEach(function (e) {
				t.on(e, t.params.on[e])
			})
		},
		c = {
			components: {
				configurable: !0
			}
		};
	p.prototype.on = function (e, t) {
		var i = this;
		return "function" != typeof t ? i : (e.split(" ").forEach(function (e) {
			i.eventsListeners[e] || (i.eventsListeners[e] = []), i.eventsListeners[e].push(t)
		}), i)
	}, p.prototype.once = function (e, t) {
		var i = this;
		if ("function" != typeof t) return i;
		return i.on(e, function s() {
			for (var a = [], r = arguments.length; r--;) a[r] = arguments[r];
			t.apply(i, a), i.off(e, s)
		})
	}, p.prototype.off = function (e, t) {
		var i = this;
		return e.split(" ").forEach(function (e) {
			void 0 === t ? i.eventsListeners[e] = [] : i.eventsListeners[e].forEach(function (s, a) {
				s === t && i.eventsListeners[e].splice(a, 1)
			})
		}), i
	}, p.prototype.emit = function () {
		for (var e = [], t = arguments.length; t--;) e[t] = arguments[t];
		var i, s, a, r = this;
		return r.eventsListeners ? ("string" == typeof e[0] || Array.isArray(e[0]) ? (i = e[0], s = e.slice(1, e.length), a = r) : (i = e[0].events, s = e[0].data, a = e[0].context || r), (Array.isArray(i) ? i : i.split(" ")).forEach(function (e) {
			if (r.eventsListeners[e]) {
				var t = [];
				r.eventsListeners[e].forEach(function (e) {
					t.push(e)
				}), t.forEach(function (e) {
					e.apply(a, s)
				})
			}
		}), r) : r
	}, p.prototype.useModulesParams = function (e) {
		var t = this;
		t.modules && Object.keys(t.modules).forEach(function (i) {
			var s = t.modules[i];
			s.params && d.extend(e, s.params)
		})
	}, p.prototype.useModules = function (e) {
		void 0 === e && (e = {});
		var t = this;
		t.modules && Object.keys(t.modules).forEach(function (i) {
			var s = t.modules[i],
				a = e[i] || {};
			s.instance && Object.keys(s.instance).forEach(function (e) {
				var i = s.instance[e];
				t[e] = "function" == typeof i ? i.bind(t) : i
			}), s.on && t.on && Object.keys(s.on).forEach(function (e) {
				t.on(e, s.on[e])
			}), s.create && s.create.bind(t)(a)
		})
	}, c.components.set = function (e) {
		this.use && this.use(e)
	}, p.installModule = function (e) {
		for (var t = [], i = arguments.length - 1; i-- > 0;) t[i] = arguments[i + 1];
		var s = this;
		s.prototype.modules || (s.prototype.modules = {});
		var a = e.name || Object.keys(s.prototype.modules).length + "_" + d.now();
		return s.prototype.modules[a] = e, e.proto && Object.keys(e.proto).forEach(function (t) {
			s.prototype[t] = e.proto[t]
		}), e.static && Object.keys(e.static).forEach(function (t) {
			s[t] = e.static[t]
		}), e.install && e.install.apply(s, t), s
	}, p.use = function (e) {
		for (var t = [], i = arguments.length - 1; i-- > 0;) t[i] = arguments[i + 1];
		var s = this;
		return Array.isArray(e) ? (e.forEach(function (e) {
			return s.installModule(e)
		}), s) : s.installModule.apply(s, [e].concat(t))
	}, Object.defineProperties(p, c);
	var u = {
			updateSize: function () {
				var e, t, i = this.$el;
				e = void 0 !== this.params.width ? this.params.width : i[0].clientWidth, t = void 0 !== this.params.height ? this.params.height : i[0].clientHeight, 0 === e && this.isHorizontal() || 0 === t && this.isVertical() || (e = e - parseInt(i.css("padding-left"), 10) - parseInt(i.css("padding-right"), 10), t = t - parseInt(i.css("padding-top"), 10) - parseInt(i.css("padding-bottom"), 10), d.extend(this, {
					width: e,
					height: t,
					size: this.isHorizontal() ? e : t
				}))
			},
			updateSlides: function () {
				var e = this.params,
					t = this.$wrapperEl,
					i = this.size,
					s = this.rtl,
					a = this.wrongRTL,
					r = t.children("." + this.params.slideClass),
					n = this.virtual && e.virtual.enabled ? this.virtual.slides.length : r.length,
					o = [],
					l = [],
					p = [],
					c = e.slidesOffsetBefore;
				"function" == typeof c && (c = e.slidesOffsetBefore.call(this));
				var u = e.slidesOffsetAfter;
				"function" == typeof u && (u = e.slidesOffsetAfter.call(this));
				var v = n,
					f = this.snapGrid.length,
					m = this.snapGrid.length,
					g = e.spaceBetween,
					b = -c,
					w = 0,
					y = 0;
				if (void 0 !== i) {
					var x, E;
					"string" == typeof g && g.indexOf("%") >= 0 && (g = parseFloat(g.replace("%", "")) / 100 * i), this.virtualSize = -g, s ? r.css({
						marginLeft: "",
						marginTop: ""
					}) : r.css({
						marginRight: "",
						marginBottom: ""
					}), e.slidesPerColumn > 1 && (x = Math.floor(n / e.slidesPerColumn) === n / this.params.slidesPerColumn ? n : Math.ceil(n / e.slidesPerColumn) * e.slidesPerColumn, "auto" !== e.slidesPerView && "row" === e.slidesPerColumnFill && (x = Math.max(x, e.slidesPerView * e.slidesPerColumn)));
					for (var T, S = e.slidesPerColumn, C = x / S, M = C - (e.slidesPerColumn * C - n), z = 0; z < n; z += 1) {
						E = 0;
						var P = r.eq(z);
						if (e.slidesPerColumn > 1) {
							var k = void 0,
								$ = void 0,
								L = void 0;
							"column" === e.slidesPerColumnFill ? (L = z - ($ = Math.floor(z / S)) * S, ($ > M || $ === M && L === S - 1) && (L += 1) >= S && (L = 0, $ += 1), k = $ + L * x / S, P.css({
								"-webkit-box-ordinal-group": k,
								"-moz-box-ordinal-group": k,
								"-ms-flex-order": k,
								"-webkit-order": k,
								order: k
							})) : $ = z - (L = Math.floor(z / C)) * C, P.css("margin-" + (this.isHorizontal() ? "top" : "left"), 0 !== L && e.spaceBetween && e.spaceBetween + "px").attr("data-swiper-column", $).attr("data-swiper-row", L)
						}
						"none" !== P.css("display") && ("auto" === e.slidesPerView ? (E = this.isHorizontal() ? P.outerWidth(!0) : P.outerHeight(!0), e.roundLengths && (E = Math.floor(E))) : (E = (i - (e.slidesPerView - 1) * g) / e.slidesPerView, e.roundLengths && (E = Math.floor(E)), r[z] && (this.isHorizontal() ? r[z].style.width = E + "px" : r[z].style.height = E + "px")), r[z] && (r[z].swiperSlideSize = E), p.push(E), e.centeredSlides ? (b = b + E / 2 + w / 2 + g, 0 === w && 0 !== z && (b = b - i / 2 - g), 0 === z && (b = b - i / 2 - g), Math.abs(b) < .001 && (b = 0), y % e.slidesPerGroup == 0 && o.push(b), l.push(b)) : (y % e.slidesPerGroup == 0 && o.push(b), l.push(b), b = b + E + g), this.virtualSize += E + g, w = E, y += 1)
					}
					if (this.virtualSize = Math.max(this.virtualSize, i) + u, s && a && ("slide" === e.effect || "coverflow" === e.effect) && t.css({
							width: this.virtualSize + e.spaceBetween + "px"
						}), h.flexbox && !e.setWrapperSize || (this.isHorizontal() ? t.css({
							width: this.virtualSize + e.spaceBetween + "px"
						}) : t.css({
							height: this.virtualSize + e.spaceBetween + "px"
						})), e.slidesPerColumn > 1 && (this.virtualSize = (E + e.spaceBetween) * x, this.virtualSize = Math.ceil(this.virtualSize / e.slidesPerColumn) - e.spaceBetween, this.isHorizontal() ? t.css({
							width: this.virtualSize + e.spaceBetween + "px"
						}) : t.css({
							height: this.virtualSize + e.spaceBetween + "px"
						}), e.centeredSlides)) {
						T = [];
						for (var I = 0; I < o.length; I += 1) o[I] < this.virtualSize + o[0] && T.push(o[I]);
						o = T
					}
					if (!e.centeredSlides) {
						T = [];
						for (var D = 0; D < o.length; D += 1) o[D] <= this.virtualSize - i && T.push(o[D]);
						o = T, Math.floor(this.virtualSize - i) - Math.floor(o[o.length - 1]) > 1 && o.push(this.virtualSize - i)
					}
					0 === o.length && (o = [0]), 0 !== e.spaceBetween && (this.isHorizontal() ? s ? r.css({
						marginLeft: g + "px"
					}) : r.css({
						marginRight: g + "px"
					}) : r.css({
						marginBottom: g + "px"
					})), d.extend(this, {
						slides: r,
						snapGrid: o,
						slidesGrid: l,
						slidesSizesGrid: p
					}), n !== v && this.emit("slidesLengthChange"), o.length !== f && (this.params.watchOverflow && this.checkOverflow(), this.emit("snapGridLengthChange")), l.length !== m && this.emit("slidesGridLengthChange"), (e.watchSlidesProgress || e.watchSlidesVisibility) && this.updateSlidesOffset()
				}
			},
			updateAutoHeight: function () {
				var e, t = [],
					i = 0;
				if ("auto" !== this.params.slidesPerView && this.params.slidesPerView > 1)
					for (e = 0; e < Math.ceil(this.params.slidesPerView); e += 1) {
						var s = this.activeIndex + e;
						if (s > this.slides.length) break;
						t.push(this.slides.eq(s)[0])
					} else t.push(this.slides.eq(this.activeIndex)[0]);
				for (e = 0; e < t.length; e += 1)
					if (void 0 !== t[e]) {
						var a = t[e].offsetHeight;
						i = a > i ? a : i
					}
				i && this.$wrapperEl.css("height", i + "px")
			},
			updateSlidesOffset: function () {
				for (var e = this.slides, t = 0; t < e.length; t += 1) e[t].swiperSlideOffset = this.isHorizontal() ? e[t].offsetLeft : e[t].offsetTop
			},
			updateSlidesProgress: function (e) {
				void 0 === e && (e = this.translate || 0);
				var t = this.params,
					i = this.slides,
					s = this.rtl;
				if (0 !== i.length) {
					void 0 === i[0].swiperSlideOffset && this.updateSlidesOffset();
					var a = -e;
					s && (a = e), i.removeClass(t.slideVisibleClass);
					for (var r = 0; r < i.length; r += 1) {
						var n = i[r],
							o = (a + (t.centeredSlides ? this.minTranslate() : 0) - n.swiperSlideOffset) / (n.swiperSlideSize + t.spaceBetween);
						if (t.watchSlidesVisibility) {
							var l = -(a - n.swiperSlideOffset),
								d = l + this.slidesSizesGrid[r];
							(l >= 0 && l < this.size || d > 0 && d <= this.size || l <= 0 && d >= this.size) && i.eq(r).addClass(t.slideVisibleClass)
						}
						n.progress = s ? -o : o
					}
				}
			},
			updateProgress: function (e) {
				void 0 === e && (e = this.translate || 0);
				var t = this.params,
					i = this.maxTranslate() - this.minTranslate(),
					s = this.progress,
					a = this.isBeginning,
					r = this.isEnd,
					n = a,
					o = r;
				0 === i ? (s = 0, a = !0, r = !0) : (a = (s = (e - this.minTranslate()) / i) <= 0, r = s >= 1), d.extend(this, {
					progress: s,
					isBeginning: a,
					isEnd: r
				}), (t.watchSlidesProgress || t.watchSlidesVisibility) && this.updateSlidesProgress(e), a && !n && this.emit("reachBeginning toEdge"), r && !o && this.emit("reachEnd toEdge"), (n && !a || o && !r) && this.emit("fromEdge"), this.emit("progress", s)
			},
			updateSlidesClasses: function () {
				var e, t = this.slides,
					i = this.params,
					s = this.$wrapperEl,
					a = this.activeIndex,
					r = this.realIndex,
					n = this.virtual && i.virtual.enabled;
				t.removeClass(i.slideActiveClass + " " + i.slideNextClass + " " + i.slidePrevClass + " " + i.slideDuplicateActiveClass + " " + i.slideDuplicateNextClass + " " + i.slideDuplicatePrevClass), (e = n ? this.$wrapperEl.find("." + i.slideClass + '[data-swiper-slide-index="' + a + '"]') : t.eq(a)).addClass(i.slideActiveClass), i.loop && (e.hasClass(i.slideDuplicateClass) ? s.children("." + i.slideClass + ":not(." + i.slideDuplicateClass + ')[data-swiper-slide-index="' + r + '"]').addClass(i.slideDuplicateActiveClass) : s.children("." + i.slideClass + "." + i.slideDuplicateClass + '[data-swiper-slide-index="' + r + '"]').addClass(i.slideDuplicateActiveClass));
				var o = e.nextAll("." + i.slideClass).eq(0).addClass(i.slideNextClass);
				i.loop && 0 === o.length && (o = t.eq(0)).addClass(i.slideNextClass);
				var l = e.prevAll("." + i.slideClass).eq(0).addClass(i.slidePrevClass);
				i.loop && 0 === l.length && (l = t.eq(-1)).addClass(i.slidePrevClass), i.loop && (o.hasClass(i.slideDuplicateClass) ? s.children("." + i.slideClass + ":not(." + i.slideDuplicateClass + ')[data-swiper-slide-index="' + o.attr("data-swiper-slide-index") + '"]').addClass(i.slideDuplicateNextClass) : s.children("." + i.slideClass + "." + i.slideDuplicateClass + '[data-swiper-slide-index="' + o.attr("data-swiper-slide-index") + '"]').addClass(i.slideDuplicateNextClass), l.hasClass(i.slideDuplicateClass) ? s.children("." + i.slideClass + ":not(." + i.slideDuplicateClass + ')[data-swiper-slide-index="' + l.attr("data-swiper-slide-index") + '"]').addClass(i.slideDuplicatePrevClass) : s.children("." + i.slideClass + "." + i.slideDuplicateClass + '[data-swiper-slide-index="' + l.attr("data-swiper-slide-index") + '"]').addClass(i.slideDuplicatePrevClass))
			},
			updateActiveIndex: function (e) {
				var t, i = this.rtl ? this.translate : -this.translate,
					s = this.slidesGrid,
					a = this.snapGrid,
					r = this.params,
					n = this.activeIndex,
					o = this.realIndex,
					l = this.snapIndex,
					h = e;
				if (void 0 === h) {
					for (var p = 0; p < s.length; p += 1) void 0 !== s[p + 1] ? i >= s[p] && i < s[p + 1] - (s[p + 1] - s[p]) / 2 ? h = p : i >= s[p] && i < s[p + 1] && (h = p + 1) : i >= s[p] && (h = p);
					r.normalizeSlideIndex && (h < 0 || void 0 === h) && (h = 0)
				}
				if ((t = a.indexOf(i) >= 0 ? a.indexOf(i) : Math.floor(h / r.slidesPerGroup)) >= a.length && (t = a.length - 1), h !== n) {
					var c = parseInt(this.slides.eq(h).attr("data-swiper-slide-index") || h, 10);
					d.extend(this, {
						snapIndex: t,
						realIndex: c,
						previousIndex: n,
						activeIndex: h
					}), this.emit("activeIndexChange"), this.emit("snapIndexChange"), o !== c && this.emit("realIndexChange"), this.emit("slideChange")
				} else t !== l && (this.snapIndex = t, this.emit("snapIndexChange"))
			},
			updateClickedSlide: function (e) {
				var t = this.params,
					i = s(e.target).closest("." + t.slideClass)[0],
					a = !1;
				if (i)
					for (var r = 0; r < this.slides.length; r += 1) this.slides[r] === i && (a = !0);
				if (!i || !a) return this.clickedSlide = void 0, void(this.clickedIndex = void 0);
				this.clickedSlide = i, this.virtual && this.params.virtual.enabled ? this.clickedIndex = parseInt(s(i).attr("data-swiper-slide-index"), 10) : this.clickedIndex = s(i).index(), t.slideToClickedSlide && void 0 !== this.clickedIndex && this.clickedIndex !== this.activeIndex && this.slideToClickedSlide()
			}
		},
		v = {
			getTranslate: function (e) {
				void 0 === e && (e = this.isHorizontal() ? "x" : "y");
				var t = this.params,
					i = this.rtl,
					s = this.translate,
					a = this.$wrapperEl;
				if (t.virtualTranslate) return i ? -s : s;
				var r = d.getTranslate(a[0], e);
				return i && (r = -r), r || 0
			},
			setTranslate: function (e, t) {
				var i = this.rtl,
					s = this.params,
					a = this.$wrapperEl,
					r = this.progress,
					n = 0,
					o = 0;
				this.isHorizontal() ? n = i ? -e : e : o = e, s.roundLengths && (n = Math.floor(n), o = Math.floor(o)), s.virtualTranslate || (h.transforms3d ? a.transform("translate3d(" + n + "px, " + o + "px, 0px)") : a.transform("translate(" + n + "px, " + o + "px)")), this.translate = this.isHorizontal() ? n : o;
				var l = this.maxTranslate() - this.minTranslate();
				(0 === l ? 0 : (e - this.minTranslate()) / l) !== r && this.updateProgress(e), this.emit("setTranslate", this.translate, t)
			},
			minTranslate: function () {
				return -this.snapGrid[0]
			},
			maxTranslate: function () {
				return -this.snapGrid[this.snapGrid.length - 1]
			}
		},
		f = {
			setTransition: function (e, t) {
				this.$wrapperEl.transition(e), this.emit("setTransition", e, t)
			},
			transitionStart: function (e, t) {
				void 0 === e && (e = !0);
				var i = this.activeIndex,
					s = this.params,
					a = this.previousIndex;
				s.autoHeight && this.updateAutoHeight();
				var r = t;
				if (r || (r = i > a ? "next" : i < a ? "prev" : "reset"), this.emit("transitionStart"), e && i !== a) {
					if ("reset" === r) return void this.emit("slideResetTransitionStart");
					this.emit("slideChangeTransitionStart"), "next" === r ? this.emit("slideNextTransitionStart") : this.emit("slidePrevTransitionStart")
				}
			},
			transitionEnd: function (e, t) {
				void 0 === e && (e = !0);
				var i = this.activeIndex,
					s = this.previousIndex;
				this.animating = !1, this.setTransition(0);
				var a = t;
				if (a || (a = i > s ? "next" : i < s ? "prev" : "reset"), this.emit("transitionEnd"), e && i !== s) {
					if ("reset" === a) return void this.emit("slideResetTransitionEnd");
					this.emit("slideChangeTransitionEnd"), "next" === a ? this.emit("slideNextTransitionEnd") : this.emit("slidePrevTransitionEnd")
				}
			}
		},
		m = {
			slideTo: function (e, t, i, s) {
				void 0 === e && (e = 0), void 0 === t && (t = this.params.speed), void 0 === i && (i = !0);
				var a = this,
					r = e;
				r < 0 && (r = 0);
				var n = a.params,
					o = a.snapGrid,
					l = a.slidesGrid,
					d = a.previousIndex,
					p = a.activeIndex,
					c = a.rtl,
					u = a.$wrapperEl;
				if (a.animating && n.preventIntercationOnTransition) return !1;
				var v = Math.floor(r / n.slidesPerGroup);
				v >= o.length && (v = o.length - 1), (p || n.initialSlide || 0) === (d || 0) && i && a.emit("beforeSlideChangeStart");
				var f, m = -o[v];
				if (a.updateProgress(m), n.normalizeSlideIndex)
					for (var g = 0; g < l.length; g += 1) - Math.floor(100 * m) >= Math.floor(100 * l[g]) && (r = g);
				if (a.initialized && r !== p) {
					if (!a.allowSlideNext && m < a.translate && m < a.minTranslate()) return !1;
					if (!a.allowSlidePrev && m > a.translate && m > a.maxTranslate() && (p || 0) !== r) return !1
				}
				return f = r > p ? "next" : r < p ? "prev" : "reset", c && -m === a.translate || !c && m === a.translate ? (a.updateActiveIndex(r), n.autoHeight && a.updateAutoHeight(), a.updateSlidesClasses(), "slide" !== n.effect && a.setTranslate(m), "reset" !== f && (a.transitionStart(i, f), a.transitionEnd(i, f)), !1) : (0 !== t && h.transition ? (a.setTransition(t), a.setTranslate(m), a.updateActiveIndex(r), a.updateSlidesClasses(), a.emit("beforeTransitionStart", t, s), a.transitionStart(i, f), a.animating || (a.animating = !0, u.transitionEnd(function () {
					a && !a.destroyed && a.transitionEnd(i, f)
				}))) : (a.setTransition(0), a.setTranslate(m), a.updateActiveIndex(r), a.updateSlidesClasses(), a.emit("beforeTransitionStart", t, s), a.transitionStart(i, f), a.transitionEnd(i, f)), !0)
			},
			slideToLoop: function (e, t, i, s) {
				void 0 === e && (e = 0), void 0 === t && (t = this.params.speed), void 0 === i && (i = !0);
				var a = e;
				return this.params.loop && (a += this.loopedSlides), this.slideTo(a, t, i, s)
			},
			slideNext: function (e, t, i) {
				void 0 === e && (e = this.params.speed), void 0 === t && (t = !0);
				var s = this.params,
					a = this.animating;
				return s.loop ? !a && (this.loopFix(), this._clientLeft = this.$wrapperEl[0].clientLeft, this.slideTo(this.activeIndex + s.slidesPerGroup, e, t, i)) : this.slideTo(this.activeIndex + s.slidesPerGroup, e, t, i)
			},
			slidePrev: function (e, t, i) {
				void 0 === e && (e = this.params.speed), void 0 === t && (t = !0);
				var s = this.params,
					a = this.animating;
				return s.loop ? !a && (this.loopFix(), this._clientLeft = this.$wrapperEl[0].clientLeft, this.slideTo(this.activeIndex - 1, e, t, i)) : this.slideTo(this.activeIndex - 1, e, t, i)
			},
			slideReset: function (e, t, i) {
				void 0 === e && (e = this.params.speed), void 0 === t && (t = !0);
				return this.slideTo(this.activeIndex, e, t, i)
			},
			slideToClickedSlide: function () {
				var e, t = this,
					i = t.params,
					a = t.$wrapperEl,
					r = "auto" === i.slidesPerView ? t.slidesPerViewDynamic() : i.slidesPerView,
					n = t.clickedIndex;
				if (i.loop) {
					if (t.animating) return;
					e = parseInt(s(t.clickedSlide).attr("data-swiper-slide-index"), 10), i.centeredSlides ? n < t.loopedSlides - r / 2 || n > t.slides.length - t.loopedSlides + r / 2 ? (t.loopFix(), n = a.children("." + i.slideClass + '[data-swiper-slide-index="' + e + '"]:not(.' + i.slideDuplicateClass + ")").eq(0).index(), d.nextTick(function () {
						t.slideTo(n)
					})) : t.slideTo(n) : n > t.slides.length - r ? (t.loopFix(), n = a.children("." + i.slideClass + '[data-swiper-slide-index="' + e + '"]:not(.' + i.slideDuplicateClass + ")").eq(0).index(), d.nextTick(function () {
						t.slideTo(n)
					})) : t.slideTo(n)
				} else t.slideTo(n)
			}
		},
		g = {
			loopCreate: function () {
				var t = this,
					i = t.params,
					a = t.$wrapperEl;
				a.children("." + i.slideClass + "." + i.slideDuplicateClass).remove();
				var r = a.children("." + i.slideClass);
				if (i.loopFillGroupWithBlank) {
					var n = i.slidesPerGroup - r.length % i.slidesPerGroup;
					if (n !== i.slidesPerGroup) {
						for (var o = 0; o < n; o += 1) {
							var l = s(e.createElement("div")).addClass(i.slideClass + " " + i.slideBlankClass);
							a.append(l)
						}
						r = a.children("." + i.slideClass)
					}
				}
				"auto" !== i.slidesPerView || i.loopedSlides || (i.loopedSlides = r.length), t.loopedSlides = parseInt(i.loopedSlides || i.slidesPerView, 10), t.loopedSlides += i.loopAdditionalSlides, t.loopedSlides > r.length && (t.loopedSlides = r.length);
				var d = [],
					h = [];
				r.each(function (e, i) {
					var a = s(i);
					e < t.loopedSlides && h.push(i), e < r.length && e >= r.length - t.loopedSlides && d.push(i), a.attr("data-swiper-slide-index", e)
				});
				for (var p = 0; p < h.length; p += 1) a.append(s(h[p].cloneNode(!0)).addClass(i.slideDuplicateClass));
				for (var c = d.length - 1; c >= 0; c -= 1) a.prepend(s(d[c].cloneNode(!0)).addClass(i.slideDuplicateClass))
			},
			loopFix: function () {
				var e, t = this.params,
					i = this.activeIndex,
					s = this.slides,
					a = this.loopedSlides,
					r = this.allowSlidePrev,
					n = this.allowSlideNext,
					o = this.snapGrid,
					l = this.rtl;
				this.allowSlidePrev = !0, this.allowSlideNext = !0;
				var d = -o[i] - this.getTranslate();
				i < a ? (e = s.length - 3 * a + i, e += a, this.slideTo(e, 0, !1, !0) && 0 !== d && this.setTranslate((l ? -this.translate : this.translate) - d)) : ("auto" === t.slidesPerView && i >= 2 * a || i > s.length - 2 * t.slidesPerView) && (e = -s.length + i + a, e += a, this.slideTo(e, 0, !1, !0) && 0 !== d && this.setTranslate((l ? -this.translate : this.translate) - d));
				this.allowSlidePrev = r, this.allowSlideNext = n
			},
			loopDestroy: function () {
				var e = this.$wrapperEl,
					t = this.params,
					i = this.slides;
				e.children("." + t.slideClass + "." + t.slideDuplicateClass).remove(), i.removeAttr("data-swiper-slide-index")
			}
		},
		b = {
			setGrabCursor: function (e) {
				if (!h.touch && this.params.simulateTouch) {
					var t = this.el;
					t.style.cursor = "move", t.style.cursor = e ? "-webkit-grabbing" : "-webkit-grab", t.style.cursor = e ? "-moz-grabbin" : "-moz-grab", t.style.cursor = e ? "grabbing" : "grab"
				}
			},
			unsetGrabCursor: function () {
				h.touch || (this.el.style.cursor = "")
			}
		},
		w = {
			appendSlide: function (e) {
				var t = this.$wrapperEl,
					i = this.params;
				if (i.loop && this.loopDestroy(), "object" == typeof e && "length" in e)
					for (var s = 0; s < e.length; s += 1) e[s] && t.append(e[s]);
				else t.append(e);
				i.loop && this.loopCreate(), i.observer && h.observer || this.update()
			},
			prependSlide: function (e) {
				var t = this.params,
					i = this.$wrapperEl,
					s = this.activeIndex;
				t.loop && this.loopDestroy();
				var a = s + 1;
				if ("object" == typeof e && "length" in e) {
					for (var r = 0; r < e.length; r += 1) e[r] && i.prepend(e[r]);
					a = s + e.length
				} else i.prepend(e);
				t.loop && this.loopCreate(), t.observer && h.observer || this.update(), this.slideTo(a, 0, !1)
			},
			removeSlide: function (e) {
				var t = this.params,
					i = this.$wrapperEl,
					s = this.activeIndex;
				t.loop && (this.loopDestroy(), this.slides = i.children("." + t.slideClass));
				var a, r = s;
				if ("object" == typeof e && "length" in e) {
					for (var n = 0; n < e.length; n += 1) a = e[n], this.slides[a] && this.slides.eq(a).remove(), a < r && (r -= 1);
					r = Math.max(r, 0)
				} else a = e, this.slides[a] && this.slides.eq(a).remove(), a < r && (r -= 1), r = Math.max(r, 0);
				t.loop && this.loopCreate(), t.observer && h.observer || this.update(), t.loop ? this.slideTo(r + this.loopedSlides, 0, !1) : this.slideTo(r, 0, !1)
			},
			removeAllSlides: function () {
				for (var e = [], t = 0; t < this.slides.length; t += 1) e.push(t);
				this.removeSlide(e)
			}
		},
		y = function () {
			var i = t.navigator.userAgent,
				s = {
					ios: !1,
					android: !1,
					androidChrome: !1,
					desktop: !1,
					windows: !1,
					iphone: !1,
					ipod: !1,
					ipad: !1,
					cordova: t.cordova || t.phonegap,
					phonegap: t.cordova || t.phonegap
				},
				a = i.match(/(Windows Phone);?[\s\/]+([\d.]+)?/),
				r = i.match(/(Android);?[\s\/]+([\d.]+)?/),
				n = i.match(/(iPad).*OS\s([\d_]+)/),
				o = i.match(/(iPod)(.*OS\s([\d_]+))?/),
				l = !n && i.match(/(iPhone\sOS|iOS)\s([\d_]+)/);
			if (a && (s.os = "windows", s.osVersion = a[2], s.windows = !0), r && !a && (s.os = "android", s.osVersion = r[2], s.android = !0, s.androidChrome = i.toLowerCase().indexOf("chrome") >= 0), (n || l || o) && (s.os = "ios", s.ios = !0), l && !o && (s.osVersion = l[2].replace(/_/g, "."), s.iphone = !0), n && (s.osVersion = n[2].replace(/_/g, "."), s.ipad = !0), o && (s.osVersion = o[3] ? o[3].replace(/_/g, ".") : null, s.iphone = !0), s.ios && s.osVersion && i.indexOf("Version/") >= 0 && "10" === s.osVersion.split(".")[0] && (s.osVersion = i.toLowerCase().split("version/")[1].split(" ")[0]), s.desktop = !(s.os || s.android || s.webView), s.webView = (l || n || o) && i.match(/.*AppleWebKit(?!.*Safari)/i), s.os && "ios" === s.os) {
				var d = s.osVersion.split("."),
					h = e.querySelector('meta[name="viewport"]');
				s.minimalUi = !s.webView && (o || l) && (1 * d[0] == 7 ? 1 * d[1] >= 1 : 1 * d[0] > 7) && h && h.getAttribute("content").indexOf("minimal-ui") >= 0
			}
			return s.pixelRatio = t.devicePixelRatio || 1, s
		}(),
		x = function (i) {
			var a = this.touchEventsData,
				r = this.params,
				n = this.touches;
			if (!this.animating || !r.preventIntercationOnTransition) {
				var o = i;
				if (o.originalEvent && (o = o.originalEvent), a.isTouchEvent = "touchstart" === o.type, (a.isTouchEvent || !("which" in o) || 3 !== o.which) && (!a.isTouched || !a.isMoved))
					if (r.noSwiping && s(o.target).closest(r.noSwipingSelector ? r.noSwipingSelector : "." + r.noSwipingClass)[0]) this.allowClick = !0;
					else if (!r.swipeHandler || s(o).closest(r.swipeHandler)[0]) {
					n.currentX = "touchstart" === o.type ? o.targetTouches[0].pageX : o.pageX, n.currentY = "touchstart" === o.type ? o.targetTouches[0].pageY : o.pageY;
					var l = n.currentX,
						h = n.currentY;
					if (!(y.ios && !y.cordova && r.iOSEdgeSwipeDetection && l <= r.iOSEdgeSwipeThreshold && l >= t.screen.width - r.iOSEdgeSwipeThreshold)) {
						if (d.extend(a, {
								isTouched: !0,
								isMoved: !1,
								allowTouchCallbacks: !0,
								isScrolling: void 0,
								startMoving: void 0
							}), n.startX = l, n.startY = h, a.touchStartTime = d.now(), this.allowClick = !0, this.updateSize(), this.swipeDirection = void 0, r.threshold > 0 && (a.allowThresholdMove = !1), "touchstart" !== o.type) {
							var p = !0;
							s(o.target).is(a.formElements) && (p = !1), e.activeElement && s(e.activeElement).is(a.formElements) && e.activeElement !== o.target && e.activeElement.blur(), p && this.allowTouchMove && o.preventDefault()
						}
						this.emit("touchStart", o)
					}
				}
			}
		},
		E = function (t) {
			var i = this.touchEventsData,
				a = this.params,
				r = this.touches,
				n = this.rtl,
				o = t;
			if (o.originalEvent && (o = o.originalEvent), i.isTouched) {
				if (!i.isTouchEvent || "mousemove" !== o.type) {
					var l = "touchmove" === o.type ? o.targetTouches[0].pageX : o.pageX,
						h = "touchmove" === o.type ? o.targetTouches[0].pageY : o.pageY;
					if (o.preventedByNestedSwiper) return r.startX = l, void(r.startY = h);
					if (!this.allowTouchMove) return this.allowClick = !1, void(i.isTouched && (d.extend(r, {
						startX: l,
						startY: h,
						currentX: l,
						currentY: h
					}), i.touchStartTime = d.now()));
					if (i.isTouchEvent && a.touchReleaseOnEdges && !a.loop)
						if (this.isVertical()) {
							if (h < r.startY && this.translate <= this.maxTranslate() || h > r.startY && this.translate >= this.minTranslate()) return i.isTouched = !1, void(i.isMoved = !1)
						} else if (l < r.startX && this.translate <= this.maxTranslate() || l > r.startX && this.translate >= this.minTranslate()) return;
					if (i.isTouchEvent && e.activeElement && o.target === e.activeElement && s(o.target).is(i.formElements)) return i.isMoved = !0, void(this.allowClick = !1);
					if (i.allowTouchCallbacks && this.emit("touchMove", o), !(o.targetTouches && o.targetTouches.length > 1)) {
						r.currentX = l, r.currentY = h;
						var p, c = r.currentX - r.startX,
							u = r.currentY - r.startY;
						if (void 0 === i.isScrolling) this.isHorizontal() && r.currentY === r.startY || this.isVertical() && r.currentX === r.startX ? i.isScrolling = !1 : c * c + u * u >= 25 && (p = 180 * Math.atan2(Math.abs(u), Math.abs(c)) / Math.PI, i.isScrolling = this.isHorizontal() ? p > a.touchAngle : 90 - p > a.touchAngle);
						if (i.isScrolling && this.emit("touchMoveOpposite", o), "undefined" == typeof startMoving && (r.currentX === r.startX && r.currentY === r.startY || (i.startMoving = !0)), i.isScrolling) i.isTouched = !1;
						else if (i.startMoving) {
							this.allowClick = !1, o.preventDefault(), a.touchMoveStopPropagation && !a.nested && o.stopPropagation(), i.isMoved || (a.loop && this.loopFix(), i.startTranslate = this.getTranslate(), this.setTransition(0), this.animating && this.$wrapperEl.trigger("webkitTransitionEnd transitionend"), i.allowMomentumBounce = !1, !a.grabCursor || !0 !== this.allowSlideNext && !0 !== this.allowSlidePrev || this.setGrabCursor(!0), this.emit("sliderFirstMove", o)), this.emit("sliderMove", o), i.isMoved = !0;
							var v = this.isHorizontal() ? c : u;
							r.diff = v, v *= a.touchRatio, n && (v = -v), this.swipeDirection = v > 0 ? "prev" : "next", i.currentTranslate = v + i.startTranslate;
							var f = !0,
								m = a.resistanceRatio;
							if (a.touchReleaseOnEdges && (m = 0), v > 0 && i.currentTranslate > this.minTranslate() ? (f = !1, a.resistance && (i.currentTranslate = this.minTranslate() - 1 + Math.pow(-this.minTranslate() + i.startTranslate + v, m))) : v < 0 && i.currentTranslate < this.maxTranslate() && (f = !1, a.resistance && (i.currentTranslate = this.maxTranslate() + 1 - Math.pow(this.maxTranslate() - i.startTranslate - v, m))), f && (o.preventedByNestedSwiper = !0), !this.allowSlideNext && "next" === this.swipeDirection && i.currentTranslate < i.startTranslate && (i.currentTranslate = i.startTranslate), !this.allowSlidePrev && "prev" === this.swipeDirection && i.currentTranslate > i.startTranslate && (i.currentTranslate = i.startTranslate), a.threshold > 0) {
								if (!(Math.abs(v) > a.threshold || i.allowThresholdMove)) return void(i.currentTranslate = i.startTranslate);
								if (!i.allowThresholdMove) return i.allowThresholdMove = !0, r.startX = r.currentX, r.startY = r.currentY, i.currentTranslate = i.startTranslate, void(r.diff = this.isHorizontal() ? r.currentX - r.startX : r.currentY - r.startY)
							}
							a.followFinger && ((a.freeMode || a.watchSlidesProgress || a.watchSlidesVisibility) && (this.updateActiveIndex(), this.updateSlidesClasses()), a.freeMode && (0 === i.velocities.length && i.velocities.push({
								position: r[this.isHorizontal() ? "startX" : "startY"],
								time: i.touchStartTime
							}), i.velocities.push({
								position: r[this.isHorizontal() ? "currentX" : "currentY"],
								time: d.now()
							})), this.updateProgress(i.currentTranslate), this.setTranslate(i.currentTranslate))
						}
					}
				}
			} else i.startMoving && i.isScrolling && this.emit("touchMoveOpposite", o)
		},
		T = function (e) {
			var t = this,
				i = t.touchEventsData,
				s = t.params,
				a = t.touches,
				r = t.rtl,
				n = t.$wrapperEl,
				o = t.slidesGrid,
				l = t.snapGrid,
				h = e;
			if (h.originalEvent && (h = h.originalEvent), i.allowTouchCallbacks && t.emit("touchEnd", h), i.allowTouchCallbacks = !1, !i.isTouched) return i.isMoved && s.grabCursor && t.setGrabCursor(!1), i.isMoved = !1, void(i.startMoving = !1);
			s.grabCursor && i.isMoved && i.isTouched && (!0 === t.allowSlideNext || !0 === t.allowSlidePrev) && t.setGrabCursor(!1);
			var p, c = d.now(),
				u = c - i.touchStartTime;
			if (t.allowClick && (t.updateClickedSlide(h), t.emit("tap", h), u < 300 && c - i.lastClickTime > 300 && (i.clickTimeout && clearTimeout(i.clickTimeout), i.clickTimeout = d.nextTick(function () {
					t && !t.destroyed && t.emit("click", h)
				}, 300)), u < 300 && c - i.lastClickTime < 300 && (i.clickTimeout && clearTimeout(i.clickTimeout), t.emit("doubleTap", h))), i.lastClickTime = d.now(), d.nextTick(function () {
					t.destroyed || (t.allowClick = !0)
				}), !i.isTouched || !i.isMoved || !t.swipeDirection || 0 === a.diff || i.currentTranslate === i.startTranslate) return i.isTouched = !1, i.isMoved = !1, void(i.startMoving = !1);
			if (i.isTouched = !1, i.isMoved = !1, i.startMoving = !1, p = s.followFinger ? r ? t.translate : -t.translate : -i.currentTranslate, s.freeMode) {
				if (p < -t.minTranslate()) return void t.slideTo(t.activeIndex);
				if (p > -t.maxTranslate()) return void(t.slides.length < l.length ? t.slideTo(l.length - 1) : t.slideTo(t.slides.length - 1));
				if (s.freeModeMomentum) {
					if (i.velocities.length > 1) {
						var v = i.velocities.pop(),
							f = i.velocities.pop(),
							m = v.position - f.position,
							g = v.time - f.time;
						t.velocity = m / g, t.velocity /= 2, Math.abs(t.velocity) < s.freeModeMinimumVelocity && (t.velocity = 0), (g > 150 || d.now() - v.time > 300) && (t.velocity = 0)
					} else t.velocity = 0;
					t.velocity *= s.freeModeMomentumVelocityRatio, i.velocities.length = 0;
					var b = 1e3 * s.freeModeMomentumRatio,
						w = t.velocity * b,
						y = t.translate + w;
					r && (y = -y);
					var x, E = !1,
						T = 20 * Math.abs(t.velocity) * s.freeModeMomentumBounceRatio;
					if (y < t.maxTranslate()) s.freeModeMomentumBounce ? (y + t.maxTranslate() < -T && (y = t.maxTranslate() - T), x = t.maxTranslate(), E = !0, i.allowMomentumBounce = !0) : y = t.maxTranslate();
					else if (y > t.minTranslate()) s.freeModeMomentumBounce ? (y - t.minTranslate() > T && (y = t.minTranslate() + T), x = t.minTranslate(), E = !0, i.allowMomentumBounce = !0) : y = t.minTranslate();
					else if (s.freeModeSticky) {
						for (var S, C = 0; C < l.length; C += 1)
							if (l[C] > -y) {
								S = C;
								break
							}
						y = -(y = Math.abs(l[S] - y) < Math.abs(l[S - 1] - y) || "next" === t.swipeDirection ? l[S] : l[S - 1])
					}
					if (0 !== t.velocity) b = r ? Math.abs((-y - t.translate) / t.velocity) : Math.abs((y - t.translate) / t.velocity);
					else if (s.freeModeSticky) return void t.slideReset();
					s.freeModeMomentumBounce && E ? (t.updateProgress(x), t.setTransition(b), t.setTranslate(y), t.transitionStart(!0, t.swipeDirection), t.animating = !0, n.transitionEnd(function () {
						t && !t.destroyed && i.allowMomentumBounce && (t.emit("momentumBounce"), t.setTransition(s.speed), t.setTranslate(x), n.transitionEnd(function () {
							t && !t.destroyed && t.transitionEnd()
						}))
					})) : t.velocity ? (t.updateProgress(y), t.setTransition(b), t.setTranslate(y), t.transitionStart(!0, t.swipeDirection), t.animating || (t.animating = !0, n.transitionEnd(function () {
						t && !t.destroyed && t.transitionEnd()
					}))) : t.updateProgress(y), t.updateActiveIndex(), t.updateSlidesClasses()
				}(!s.freeModeMomentum || u >= s.longSwipesMs) && (t.updateProgress(), t.updateActiveIndex(), t.updateSlidesClasses())
			} else {
				for (var M = 0, z = t.slidesSizesGrid[0], P = 0; P < o.length; P += s.slidesPerGroup) void 0 !== o[P + s.slidesPerGroup] ? p >= o[P] && p < o[P + s.slidesPerGroup] && (M = P, z = o[P + s.slidesPerGroup] - o[P]) : p >= o[P] && (M = P, z = o[o.length - 1] - o[o.length - 2]);
				var k = (p - o[M]) / z;
				if (u > s.longSwipesMs) {
					if (!s.longSwipes) return void t.slideTo(t.activeIndex);
					"next" === t.swipeDirection && (k >= s.longSwipesRatio ? t.slideTo(M + s.slidesPerGroup) : t.slideTo(M)), "prev" === t.swipeDirection && (k > 1 - s.longSwipesRatio ? t.slideTo(M + s.slidesPerGroup) : t.slideTo(M))
				} else {
					if (!s.shortSwipes) return void t.slideTo(t.activeIndex);
					"next" === t.swipeDirection && t.slideTo(M + s.slidesPerGroup), "prev" === t.swipeDirection && t.slideTo(M)
				}
			}
		},
		S = function () {
			var e = this.params,
				t = this.el;
			if (!t || 0 !== t.offsetWidth) {
				e.breakpoints && this.setBreakpoint();
				var i = this.allowSlideNext,
					s = this.allowSlidePrev;
				if (this.allowSlideNext = !0, this.allowSlidePrev = !0, this.updateSize(), this.updateSlides(), e.freeMode) {
					var a = Math.min(Math.max(this.translate, this.maxTranslate()), this.minTranslate());
					this.setTranslate(a), this.updateActiveIndex(), this.updateSlidesClasses(), e.autoHeight && this.updateAutoHeight()
				} else this.updateSlidesClasses(), ("auto" === e.slidesPerView || e.slidesPerView > 1) && this.isEnd && !this.params.centeredSlides ? this.slideTo(this.slides.length - 1, 0, !1, !0) : this.slideTo(this.activeIndex, 0, !1, !0);
				this.allowSlidePrev = s, this.allowSlideNext = i
			}
		},
		C = function (e) {
			this.allowClick || (this.params.preventClicks && e.preventDefault(), this.params.preventClicksPropagation && this.animating && (e.stopPropagation(), e.stopImmediatePropagation()))
		};
	var M = {
			attachEvents: function () {
				var t = this.params,
					i = this.touchEvents,
					s = this.el,
					a = this.wrapperEl;
				this.onTouchStart = x.bind(this), this.onTouchMove = E.bind(this), this.onTouchEnd = T.bind(this), this.onClick = C.bind(this);
				var r = "container" === t.touchEventsTarget ? s : a,
					n = !!t.nested;
				if (h.touch || !h.pointerEvents && !h.prefixedPointerEvents) {
					if (h.touch) {
						var o = !("touchstart" !== i.start || !h.passiveListener || !t.passiveListeners) && {
							passive: !0,
							capture: !1
						};
						r.addEventListener(i.start, this.onTouchStart, o), r.addEventListener(i.move, this.onTouchMove, h.passiveListener ? {
							passive: !1,
							capture: n
						} : n), r.addEventListener(i.end, this.onTouchEnd, o)
					}(t.simulateTouch && !y.ios && !y.android || t.simulateTouch && !h.touch && y.ios) && (r.addEventListener("mousedown", this.onTouchStart, !1), e.addEventListener("mousemove", this.onTouchMove, n), e.addEventListener("mouseup", this.onTouchEnd, !1))
				} else r.addEventListener(i.start, this.onTouchStart, !1), e.addEventListener(i.move, this.onTouchMove, n), e.addEventListener(i.end, this.onTouchEnd, !1);
				(t.preventClicks || t.preventClicksPropagation) && r.addEventListener("click", this.onClick, !0), this.on("resize observerUpdate", S)
			},
			detachEvents: function () {
				var t = this.params,
					i = this.touchEvents,
					s = this.el,
					a = this.wrapperEl,
					r = "container" === t.touchEventsTarget ? s : a,
					n = !!t.nested;
				if (h.touch || !h.pointerEvents && !h.prefixedPointerEvents) {
					if (h.touch) {
						var o = !("onTouchStart" !== i.start || !h.passiveListener || !t.passiveListeners) && {
							passive: !0,
							capture: !1
						};
						r.removeEventListener(i.start, this.onTouchStart, o), r.removeEventListener(i.move, this.onTouchMove, n), r.removeEventListener(i.end, this.onTouchEnd, o)
					}(t.simulateTouch && !y.ios && !y.android || t.simulateTouch && !h.touch && y.ios) && (r.removeEventListener("mousedown", this.onTouchStart, !1), e.removeEventListener("mousemove", this.onTouchMove, n), e.removeEventListener("mouseup", this.onTouchEnd, !1))
				} else r.removeEventListener(i.start, this.onTouchStart, !1), e.removeEventListener(i.move, this.onTouchMove, n), e.removeEventListener(i.end, this.onTouchEnd, !1);
				(t.preventClicks || t.preventClicksPropagation) && r.removeEventListener("click", this.onClick, !0), this.off("resize observerUpdate", S)
			}
		},
		z = {
			setBreakpoint: function () {
				var e = this.activeIndex,
					t = this.loopedSlides;
				void 0 === t && (t = 0);
				var i = this.params,
					s = i.breakpoints;
				if (s && (!s || 0 !== Object.keys(s).length)) {
					var a = this.getBreakpoint(s);
					if (a && this.currentBreakpoint !== a) {
						var r = a in s ? s[a] : this.originalParams,
							n = i.loop && r.slidesPerView !== i.slidesPerView;
						d.extend(this.params, r), d.extend(this, {
							allowTouchMove: this.params.allowTouchMove,
							allowSlideNext: this.params.allowSlideNext,
							allowSlidePrev: this.params.allowSlidePrev
						}), this.currentBreakpoint = a, n && (this.loopDestroy(), this.loopCreate(), this.updateSlides(), this.slideTo(e - t + this.loopedSlides, 0, !1)), this.emit("breakpoint", r)
					}
				}
			},
			getBreakpoint: function (e) {
				if (e) {
					var i = !1,
						s = [];
					Object.keys(e).forEach(function (e) {
						s.push(e)
					}), s.sort(function (e, t) {
						return parseInt(e, 10) - parseInt(t, 10)
					});
					for (var a = 0; a < s.length; a += 1) {
						var r = s[a];
						r >= t.innerWidth && !i && (i = r)
					}
					return i || "max"
				}
			}
		},
		P = function () {
			return {
				isIE: !!t.navigator.userAgent.match(/Trident/g) || !!t.navigator.userAgent.match(/MSIE/g),
				isSafari: (e = t.navigator.userAgent.toLowerCase(), e.indexOf("safari") >= 0 && e.indexOf("chrome") < 0 && e.indexOf("android") < 0),
				isUiWebView: /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(t.navigator.userAgent)
			};
			var e
		}();
	var k = {
			init: !0,
			direction: "horizontal",
			touchEventsTarget: "container",
			initialSlide: 0,
			speed: 300,
			preventIntercationOnTransition: !1,
			iOSEdgeSwipeDetection: !1,
			iOSEdgeSwipeThreshold: 20,
			freeMode: !1,
			freeModeMomentum: !0,
			freeModeMomentumRatio: 1,
			freeModeMomentumBounce: !0,
			freeModeMomentumBounceRatio: 1,
			freeModeMomentumVelocityRatio: 1,
			freeModeSticky: !1,
			freeModeMinimumVelocity: .02,
			autoHeight: !1,
			setWrapperSize: !1,
			virtualTranslate: !1,
			effect: "slide",
			breakpoints: void 0,
			spaceBetween: 0,
			slidesPerView: 1,
			slidesPerColumn: 1,
			slidesPerColumnFill: "column",
			slidesPerGroup: 1,
			centeredSlides: !1,
			slidesOffsetBefore: 0,
			slidesOffsetAfter: 0,
			normalizeSlideIndex: !0,
			watchOverflow: !1,
			roundLengths: !1,
			touchRatio: 1,
			touchAngle: 45,
			simulateTouch: !0,
			shortSwipes: !0,
			longSwipes: !0,
			longSwipesRatio: .5,
			longSwipesMs: 300,
			followFinger: !0,
			allowTouchMove: !0,
			threshold: 0,
			touchMoveStopPropagation: !0,
			touchReleaseOnEdges: !1,
			uniqueNavElements: !0,
			resistance: !0,
			resistanceRatio: .85,
			watchSlidesProgress: !1,
			watchSlidesVisibility: !1,
			grabCursor: !1,
			preventClicks: !0,
			preventClicksPropagation: !0,
			slideToClickedSlide: !1,
			preloadImages: !0,
			updateOnImagesReady: !0,
			loop: !1,
			loopAdditionalSlides: 0,
			loopedSlides: null,
			loopFillGroupWithBlank: !1,
			allowSlidePrev: !0,
			allowSlideNext: !0,
			swipeHandler: null,
			noSwiping: !0,
			noSwipingClass: "swiper-no-swiping",
			noSwipingSelector: null,
			passiveListeners: !0,
			containerModifierClass: "swiper-container-",
			slideClass: "swiper-slide",
			slideBlankClass: "swiper-slide-invisible-blank",
			slideActiveClass: "swiper-slide-active",
			slideDuplicateActiveClass: "swiper-slide-duplicate-active",
			slideVisibleClass: "swiper-slide-visible",
			slideDuplicateClass: "swiper-slide-duplicate",
			slideNextClass: "swiper-slide-next",
			slideDuplicateNextClass: "swiper-slide-duplicate-next",
			slidePrevClass: "swiper-slide-prev",
			slideDuplicatePrevClass: "swiper-slide-duplicate-prev",
			wrapperClass: "swiper-wrapper",
			runCallbacksOnInit: !0
		},
		$ = {
			update: u,
			translate: v,
			transition: f,
			slide: m,
			loop: g,
			grabCursor: b,
			manipulation: w,
			events: M,
			breakpoints: z,
			checkOverflow: {
				checkOverflow: function () {
					var e = this.isLocked;
					this.isLocked = 1 === this.snapGrid.length, this.allowTouchMove = !this.isLocked, e && e !== this.isLocked && (this.isEnd = !1, this.navigation.update())
				}
			},
			classes: {
				addClasses: function () {
					var e = this.classNames,
						t = this.params,
						i = this.rtl,
						s = this.$el,
						a = [];
					a.push(t.direction), t.freeMode && a.push("free-mode"), h.flexbox || a.push("no-flexbox"), t.autoHeight && a.push("autoheight"), i && a.push("rtl"), t.slidesPerColumn > 1 && a.push("multirow"), y.android && a.push("android"), y.ios && a.push("ios"), P.isIE && (h.pointerEvents || h.prefixedPointerEvents) && a.push("wp8-" + t.direction), a.forEach(function (i) {
						e.push(t.containerModifierClass + i)
					}), s.addClass(e.join(" "))
				},
				removeClasses: function () {
					var e = this.$el,
						t = this.classNames;
					e.removeClass(t.join(" "))
				}
			},
			images: {
				loadImage: function (e, i, s, a, r, n) {
					var o;

					function l() {
						n && n()
					}
					e.complete && r ? l() : i ? ((o = new t.Image).onload = l, o.onerror = l, a && (o.sizes = a), s && (o.srcset = s), i && (o.src = i)) : l()
				},
				preloadImages: function () {
					var e = this;

					function t() {
						void 0 !== e && null !== e && e && !e.destroyed && (void 0 !== e.imagesLoaded && (e.imagesLoaded += 1), e.imagesLoaded === e.imagesToLoad.length && (e.params.updateOnImagesReady && e.update(), e.emit("imagesReady")))
					}
					e.imagesToLoad = e.$el.find("img");
					for (var i = 0; i < e.imagesToLoad.length; i += 1) {
						var s = e.imagesToLoad[i];
						e.loadImage(s, s.currentSrc || s.getAttribute("src"), s.srcset || s.getAttribute("srcset"), s.sizes || s.getAttribute("sizes"), !0, t)
					}
				}
			}
		},
		L = {},
		I = function (e) {
			function t() {
				for (var i, a, r, n = [], o = arguments.length; o--;) n[o] = arguments[o];
				1 === n.length && n[0].constructor && n[0].constructor === Object ? a = n[0] : (i = (r = n)[0], a = r[1]);
				a || (a = {}), a = d.extend({}, a), i && !a.el && (a.el = i), e.call(this, a), Object.keys($).forEach(function (e) {
					Object.keys($[e]).forEach(function (i) {
						t.prototype[i] || (t.prototype[i] = $[e][i])
					})
				});
				var l = this;
				void 0 === l.modules && (l.modules = {}), Object.keys(l.modules).forEach(function (e) {
					var t = l.modules[e];
					if (t.params) {
						var i = Object.keys(t.params)[0],
							s = t.params[i];
						if ("object" != typeof s) return;
						if (!(i in a && "enabled" in s)) return;
						!0 === a[i] && (a[i] = {
							enabled: !0
						}), "object" != typeof a[i] || "enabled" in a[i] || (a[i].enabled = !0), a[i] || (a[i] = {
							enabled: !1
						})
					}
				});
				var p = d.extend({}, k);
				l.useModulesParams(p), l.params = d.extend({}, p, L, a), l.originalParams = d.extend({}, l.params), l.passedParams = d.extend({}, a), l.$ = s;
				var c = s(l.params.el);
				if (i = c[0]) {
					if (c.length > 1) {
						var u = [];
						return c.each(function (e, i) {
							var s = d.extend({}, a, {
								el: i
							});
							u.push(new t(s))
						}), u
					}
					i.swiper = l, c.data("swiper", l);
					var v, f, m = c.children("." + l.params.wrapperClass);
					return d.extend(l, {
						$el: c,
						el: i,
						$wrapperEl: m,
						wrapperEl: m[0],
						classNames: [],
						slides: s(),
						slidesGrid: [],
						snapGrid: [],
						slidesSizesGrid: [],
						isHorizontal: function () {
							return "horizontal" === l.params.direction
						},
						isVertical: function () {
							return "vertical" === l.params.direction
						},
						rtl: "horizontal" === l.params.direction && ("rtl" === i.dir.toLowerCase() || "rtl" === c.css("direction")),
						wrongRTL: "-webkit-box" === m.css("display"),
						activeIndex: 0,
						realIndex: 0,
						isBeginning: !0,
						isEnd: !1,
						translate: 0,
						progress: 0,
						velocity: 0,
						animating: !1,
						allowSlideNext: l.params.allowSlideNext,
						allowSlidePrev: l.params.allowSlidePrev,
						touchEvents: (v = ["touchstart", "touchmove", "touchend"], f = ["mousedown", "mousemove", "mouseup"], h.pointerEvents ? f = ["pointerdown", "pointermove", "pointerup"] : h.prefixedPointerEvents && (f = ["MSPointerDown", "MSPointerMove", "MSPointerUp"]), l.touchEventsTouch = {
							start: v[0],
							move: v[1],
							end: v[2]
						}, l.touchEventsDesktop = {
							start: f[0],
							move: f[1],
							end: f[2]
						}, h.touch || !l.params.simulateTouch ? l.touchEventsTouch : l.touchEventsDesktop),
						touchEventsData: {
							isTouched: void 0,
							isMoved: void 0,
							allowTouchCallbacks: void 0,
							touchStartTime: void 0,
							isScrolling: void 0,
							currentTranslate: void 0,
							startTranslate: void 0,
							allowThresholdMove: void 0,
							formElements: "input, select, option, textarea, button, video",
							lastClickTime: d.now(),
							clickTimeout: void 0,
							velocities: [],
							allowMomentumBounce: void 0,
							isTouchEvent: void 0,
							startMoving: void 0
						},
						allowClick: !0,
						allowTouchMove: l.params.allowTouchMove,
						touches: {
							startX: 0,
							startY: 0,
							currentX: 0,
							currentY: 0,
							diff: 0
						},
						imagesToLoad: [],
						imagesLoaded: 0
					}), l.useModules(), l.params.init && l.init(), l
				}
			}
			e && (t.__proto__ = e), t.prototype = Object.create(e && e.prototype), t.prototype.constructor = t;
			var i = {
				extendedDefaults: {
					configurable: !0
				},
				defaults: {
					configurable: !0
				},
				Class: {
					configurable: !0
				},
				$: {
					configurable: !0
				}
			};
			return t.prototype.slidesPerViewDynamic = function () {
				var e = this.params,
					t = this.slides,
					i = this.slidesGrid,
					s = this.size,
					a = this.activeIndex,
					r = 1;
				if (e.centeredSlides) {
					for (var n, o = t[a].swiperSlideSize, l = a + 1; l < t.length; l += 1) t[l] && !n && (r += 1, (o += t[l].swiperSlideSize) > s && (n = !0));
					for (var d = a - 1; d >= 0; d -= 1) t[d] && !n && (r += 1, (o += t[d].swiperSlideSize) > s && (n = !0))
				} else
					for (var h = a + 1; h < t.length; h += 1) i[h] - i[a] < s && (r += 1);
				return r
			}, t.prototype.update = function () {
				var e = this;
				e && !e.destroyed && (e.updateSize(), e.updateSlides(), e.updateProgress(), e.updateSlidesClasses(), e.params.freeMode ? (t(), e.params.autoHeight && e.updateAutoHeight()) : (("auto" === e.params.slidesPerView || e.params.slidesPerView > 1) && e.isEnd && !e.params.centeredSlides ? e.slideTo(e.slides.length - 1, 0, !1, !0) : e.slideTo(e.activeIndex, 0, !1, !0)) || t(), e.emit("update"));

				function t() {
					var t = e.rtl ? -1 * e.translate : e.translate,
						i = Math.min(Math.max(t, e.maxTranslate()), e.minTranslate());
					e.setTranslate(i), e.updateActiveIndex(), e.updateSlidesClasses()
				}
			}, t.prototype.init = function () {
				this.initialized || (this.emit("beforeInit"), this.params.breakpoints && this.setBreakpoint(), this.addClasses(), this.params.loop && this.loopCreate(), this.updateSize(), this.updateSlides(), this.params.watchOverflow && this.checkOverflow(), this.params.grabCursor && this.setGrabCursor(), this.params.preloadImages && this.preloadImages(), this.params.loop ? this.slideTo(this.params.initialSlide + this.loopedSlides, 0, this.params.runCallbacksOnInit) : this.slideTo(this.params.initialSlide, 0, this.params.runCallbacksOnInit), this.attachEvents(), this.initialized = !0, this.emit("init"))
			}, t.prototype.destroy = function (e, t) {
				void 0 === e && (e = !0), void 0 === t && (t = !0);
				var i = this,
					s = i.params,
					a = i.$el,
					r = i.$wrapperEl,
					n = i.slides;
				i.emit("beforeDestroy"), i.initialized = !1, i.detachEvents(), s.loop && i.loopDestroy(), t && (i.removeClasses(), a.removeAttr("style"), r.removeAttr("style"), n && n.length && n.removeClass([s.slideVisibleClass, s.slideActiveClass, s.slideNextClass, s.slidePrevClass].join(" ")).removeAttr("style").removeAttr("data-swiper-slide-index").removeAttr("data-swiper-column").removeAttr("data-swiper-row")), i.emit("destroy"), Object.keys(i.eventsListeners).forEach(function (e) {
					i.off(e)
				}), !1 !== e && (i.$el[0].swiper = null, i.$el.data("swiper", null), d.deleteProps(i)), i.destroyed = !0
			}, t.extendDefaults = function (e) {
				d.extend(L, e)
			}, i.extendedDefaults.get = function () {
				return L
			}, i.defaults.get = function () {
				return k
			}, i.Class.get = function () {
				return e
			}, i.$.get = function () {
				return s
			}, Object.defineProperties(t, i), t
		}(p),
		D = {
			name: "device",
			proto: {
				device: y
			},
			static: {
				device: y
			}
		},
		O = {
			name: "support",
			proto: {
				support: h
			},
			static: {
				support: h
			}
		},
		A = {
			name: "browser",
			proto: {
				browser: P
			},
			static: {
				browser: P
			}
		},
		H = {
			name: "resize",
			create: function () {
				var e = this;
				d.extend(e, {
					resize: {
						resizeHandler: function () {
							e && !e.destroyed && e.initialized && (e.emit("beforeResize"), e.emit("resize"))
						},
						orientationChangeHandler: function () {
							e && !e.destroyed && e.initialized && e.emit("orientationchange")
						}
					}
				})
			},
			on: {
				init: function () {
					t.addEventListener("resize", this.resize.resizeHandler), t.addEventListener("orientationchange", this.resize.orientationChangeHandler)
				},
				destroy: function () {
					t.removeEventListener("resize", this.resize.resizeHandler), t.removeEventListener("orientationchange", this.resize.orientationChangeHandler)
				}
			}
		},
		N = {
			func: t.MutationObserver || t.WebkitMutationObserver,
			attach: function (e, t) {
				void 0 === t && (t = {});
				var i = this,
					s = new(0, N.func)(function (e) {
						e.forEach(function (e) {
							i.emit("observerUpdate", e)
						})
					});
				s.observe(e, {
					attributes: void 0 === t.attributes || t.attributes,
					childList: void 0 === t.childList || t.childList,
					characterData: void 0 === t.characterData || t.characterData
				}), i.observer.observers.push(s)
			},
			init: function () {
				if (h.observer && this.params.observer) {
					if (this.params.observeParents)
						for (var e = this.$el.parents(), t = 0; t < e.length; t += 1) this.observer.attach(e[t]);
					this.observer.attach(this.$el[0], {
						childList: !1
					}), this.observer.attach(this.$wrapperEl[0], {
						attributes: !1
					})
				}
			},
			destroy: function () {
				this.observer.observers.forEach(function (e) {
					e.disconnect()
				}), this.observer.observers = []
			}
		},
		X = {
			name: "observer",
			params: {
				observer: !1,
				observeParents: !1
			},
			create: function () {
				d.extend(this, {
					observer: {
						init: N.init.bind(this),
						attach: N.attach.bind(this),
						destroy: N.destroy.bind(this),
						observers: []
					}
				})
			},
			on: {
				init: function () {
					this.observer.init()
				},
				destroy: function () {
					this.observer.destroy()
				}
			}
		},
		Y = {
			update: function (e) {
				var t = this,
					i = t.params,
					s = i.slidesPerView,
					a = i.slidesPerGroup,
					r = i.centeredSlides,
					n = t.virtual,
					o = n.from,
					l = n.to,
					h = n.slides,
					p = n.slidesGrid,
					c = n.renderSlide,
					u = n.offset;
				t.updateActiveIndex();
				var v, f, m, g = t.activeIndex || 0;
				v = t.rtl && t.isHorizontal() ? "right" : t.isHorizontal() ? "left" : "top", r ? (f = Math.floor(s / 2) + a, m = Math.floor(s / 2) + a) : (f = s + (a - 1), m = a);
				var b = Math.max((g || 0) - m, 0),
					w = Math.min((g || 0) + f, h.length - 1),
					y = (t.slidesGrid[b] || 0) - (t.slidesGrid[0] || 0);

				function x() {
					t.updateSlides(), t.updateProgress(), t.updateSlidesClasses(), t.lazy && t.params.lazy.enabled && t.lazy.load()
				}
				if (d.extend(t.virtual, {
						from: b,
						to: w,
						offset: y,
						slidesGrid: t.slidesGrid
					}), o === b && l === w && !e) return t.slidesGrid !== p && y !== u && t.slides.css(v, y + "px"), void t.updateProgress();
				if (t.params.virtual.renderExternal) return t.params.virtual.renderExternal.call(t, {
					offset: y,
					from: b,
					to: w,
					slides: function () {
						for (var e = [], t = b; t <= w; t += 1) e.push(h[t]);
						return e
					}()
				}), void x();
				var E = [],
					T = [];
				if (e) t.$wrapperEl.find("." + t.params.slideClass).remove();
				else
					for (var S = o; S <= l; S += 1)(S < b || S > w) && t.$wrapperEl.find("." + t.params.slideClass + '[data-swiper-slide-index="' + S + '"]').remove();
				for (var C = 0; C < h.length; C += 1) C >= b && C <= w && (void 0 === l || e ? T.push(C) : (C > l && T.push(C), C < o && E.push(C)));
				T.forEach(function (e) {
					t.$wrapperEl.append(c(h[e], e))
				}), E.sort(function (e, t) {
					return e < t
				}).forEach(function (e) {
					t.$wrapperEl.prepend(c(h[e], e))
				}), t.$wrapperEl.children(".swiper-slide").css(v, y + "px"), x()
			},
			renderSlide: function (e, t) {
				var i = this.params.virtual;
				if (i.cache && this.virtual.cache[t]) return this.virtual.cache[t];
				var a = i.renderSlide ? s(i.renderSlide.call(this, e, t)) : s('<div class="' + this.params.slideClass + '" data-swiper-slide-index="' + t + '">' + e + "</div>");
				return a.attr("data-swiper-slide-index") || a.attr("data-swiper-slide-index", t), i.cache && (this.virtual.cache[t] = a), a
			},
			appendSlide: function (e) {
				this.virtual.slides.push(e), this.virtual.update(!0)
			},
			prependSlide: function (e) {
				if (this.virtual.slides.unshift(e), this.params.virtual.cache) {
					var t = this.virtual.cache,
						i = {};
					Object.keys(t).forEach(function (e) {
						i[e + 1] = t[e]
					}), this.virtual.cache = i
				}
				this.virtual.update(!0), this.slideNext(0)
			}
		},
		B = {
			name: "virtual",
			params: {
				virtual: {
					enabled: !1,
					slides: [],
					cache: !0,
					renderSlide: null,
					renderExternal: null
				}
			},
			create: function () {
				d.extend(this, {
					virtual: {
						update: Y.update.bind(this),
						appendSlide: Y.appendSlide.bind(this),
						prependSlide: Y.prependSlide.bind(this),
						renderSlide: Y.renderSlide.bind(this),
						slides: this.params.virtual.slides,
						cache: {}
					}
				})
			},
			on: {
				beforeInit: function () {
					if (this.params.virtual.enabled) {
						this.classNames.push(this.params.containerModifierClass + "virtual");
						var e = {
							watchSlidesProgress: !0
						};
						d.extend(this.params, e), d.extend(this.originalParams, e), this.virtual.update()
					}
				},
				setTranslate: function () {
					this.params.virtual.enabled && this.virtual.update()
				}
			}
		},
		G = {
			handle: function (i) {
				var s = i;
				s.originalEvent && (s = s.originalEvent);
				var a = s.keyCode || s.charCode;
				if (!this.allowSlideNext && (this.isHorizontal() && 39 === a || this.isVertical() && 40 === a)) return !1;
				if (!this.allowSlidePrev && (this.isHorizontal() && 37 === a || this.isVertical() && 38 === a)) return !1;
				if (!(s.shiftKey || s.altKey || s.ctrlKey || s.metaKey || e.activeElement && e.activeElement.nodeName && ("input" === e.activeElement.nodeName.toLowerCase() || "textarea" === e.activeElement.nodeName.toLowerCase()))) {
					if (this.params.keyboard.onlyInViewport && (37 === a || 39 === a || 38 === a || 40 === a)) {
						var r = !1;
						if (this.$el.parents("." + this.params.slideClass).length > 0 && 0 === this.$el.parents("." + this.params.slideActiveClass).length) return;
						var n = t.innerWidth,
							o = t.innerHeight,
							l = this.$el.offset();
						this.rtl && (l.left -= this.$el[0].scrollLeft);
						for (var d = [
								[l.left, l.top],
								[l.left + this.width, l.top],
								[l.left, l.top + this.height],
								[l.left + this.width, l.top + this.height]
							], h = 0; h < d.length; h += 1) {
							var p = d[h];
							p[0] >= 0 && p[0] <= n && p[1] >= 0 && p[1] <= o && (r = !0)
						}
						if (!r) return
					}
					this.isHorizontal() ? (37 !== a && 39 !== a || (s.preventDefault ? s.preventDefault() : s.returnValue = !1), (39 === a && !this.rtl || 37 === a && this.rtl) && this.slideNext(), (37 === a && !this.rtl || 39 === a && this.rtl) && this.slidePrev()) : (38 !== a && 40 !== a || (s.preventDefault ? s.preventDefault() : s.returnValue = !1), 40 === a && this.slideNext(), 38 === a && this.slidePrev()), this.emit("keyPress", a)
				}
			},
			enable: function () {
				this.keyboard.enabled || (s(e).on("keydown", this.keyboard.handle), this.keyboard.enabled = !0)
			},
			disable: function () {
				this.keyboard.enabled && (s(e).off("keydown", this.keyboard.handle), this.keyboard.enabled = !1)
			}
		},
		V = {
			name: "keyboard",
			params: {
				keyboard: {
					enabled: !1,
					onlyInViewport: !0
				}
			},
			create: function () {
				d.extend(this, {
					keyboard: {
						enabled: !1,
						enable: G.enable.bind(this),
						disable: G.disable.bind(this),
						handle: G.handle.bind(this)
					}
				})
			},
			on: {
				init: function () {
					this.params.keyboard.enabled && this.keyboard.enable()
				},
				destroy: function () {
					this.keyboard.enabled && this.keyboard.disable()
				}
			}
		};
	var R = {
			lastScrollTime: d.now(),
			event: t.navigator.userAgent.indexOf("firefox") > -1 ? "DOMMouseScroll" : function () {
				var t = "onwheel" in e;
				if (!t) {
					var i = e.createElement("div");
					i.setAttribute("onwheel", "return;"), t = "function" == typeof i.onwheel
				}
				return !t && e.implementation && e.implementation.hasFeature && !0 !== e.implementation.hasFeature("", "") && (t = e.implementation.hasFeature("Events.wheel", "3.0")), t
			}() ? "wheel" : "mousewheel",
			normalize: function (e) {
				var t = 0,
					i = 0,
					s = 0,
					a = 0;
				return "detail" in e && (i = e.detail), "wheelDelta" in e && (i = -e.wheelDelta / 120), "wheelDeltaY" in e && (i = -e.wheelDeltaY / 120), "wheelDeltaX" in e && (t = -e.wheelDeltaX / 120), "axis" in e && e.axis === e.HORIZONTAL_AXIS && (t = i, i = 0), s = 10 * t, a = 10 * i, "deltaY" in e && (a = e.deltaY), "deltaX" in e && (s = e.deltaX), (s || a) && e.deltaMode && (1 === e.deltaMode ? (s *= 40, a *= 40) : (s *= 800, a *= 800)), s && !t && (t = s < 1 ? -1 : 1), a && !i && (i = a < 1 ? -1 : 1), {
					spinX: t,
					spinY: i,
					pixelX: s,
					pixelY: a
				}
			},
			handle: function (e) {
				var i = e,
					s = this,
					a = s.params.mousewheel;
				i.originalEvent && (i = i.originalEvent);
				var r = 0,
					n = s.rtl ? -1 : 1,
					o = R.normalize(i);
				if (a.forceToAxis)
					if (s.isHorizontal()) {
						if (!(Math.abs(o.pixelX) > Math.abs(o.pixelY))) return !0;
						r = o.pixelX * n
					} else {
						if (!(Math.abs(o.pixelY) > Math.abs(o.pixelX))) return !0;
						r = o.pixelY
					}
				else r = Math.abs(o.pixelX) > Math.abs(o.pixelY) ? -o.pixelX * n : -o.pixelY;
				if (0 === r) return !0;
				if (a.invert && (r = -r), s.params.freeMode) {
					var l = s.getTranslate() + r * a.sensitivity,
						h = s.isBeginning,
						p = s.isEnd;
					if (l >= s.minTranslate() && (l = s.minTranslate()), l <= s.maxTranslate() && (l = s.maxTranslate()), s.setTransition(0), s.setTranslate(l), s.updateProgress(), s.updateActiveIndex(), s.updateSlidesClasses(), (!h && s.isBeginning || !p && s.isEnd) && s.updateSlidesClasses(), s.params.freeModeSticky && (clearTimeout(s.mousewheel.timeout), s.mousewheel.timeout = d.nextTick(function () {
							s.slideReset()
						}, 300)), s.emit("scroll", i), s.params.autoplay && s.params.autoplayDisableOnInteraction && s.stopAutoplay(), l === s.minTranslate() || l === s.maxTranslate()) return !0
				} else {
					if (d.now() - s.mousewheel.lastScrollTime > 60)
						if (r < 0)
							if (s.isEnd && !s.params.loop || s.animating) {
								if (a.releaseOnEdges) return !0
							} else s.slideNext(), s.emit("scroll", i);
					else if (s.isBeginning && !s.params.loop || s.animating) {
						if (a.releaseOnEdges) return !0
					} else s.slidePrev(), s.emit("scroll", i);
					s.mousewheel.lastScrollTime = (new t.Date).getTime()
				}
				return i.preventDefault ? i.preventDefault() : i.returnValue = !1, !1
			},
			enable: function () {
				if (!R.event) return !1;
				if (this.mousewheel.enabled) return !1;
				var e = this.$el;
				return "container" !== this.params.mousewheel.eventsTarged && (e = s(this.params.mousewheel.eventsTarged)), e.on(R.event, this.mousewheel.handle), this.mousewheel.enabled = !0, !0
			},
			disable: function () {
				if (!R.event) return !1;
				if (!this.mousewheel.enabled) return !1;
				var e = this.$el;
				return "container" !== this.params.mousewheel.eventsTarged && (e = s(this.params.mousewheel.eventsTarged)), e.off(R.event, this.mousewheel.handle), this.mousewheel.enabled = !1, !0
			}
		},
		F = {
			update: function () {
				var e = this.params.navigation;
				if (!this.params.loop) {
					var t = this.navigation,
						i = t.$nextEl,
						s = t.$prevEl;
					s && s.length > 0 && (this.isBeginning ? s.addClass(e.disabledClass) : s.removeClass(e.disabledClass), s[this.params.watchOverflow && this.isLocked ? "addClass" : "removeClass"](e.lockClass)), i && i.length > 0 && (this.isEnd ? i.addClass(e.disabledClass) : i.removeClass(e.disabledClass), i[this.params.watchOverflow && this.isLocked ? "addClass" : "removeClass"](e.lockClass))
				}
			},
			init: function () {
				var e, t, i = this,
					a = i.params.navigation;
				(a.nextEl || a.prevEl) && (a.nextEl && (e = s(a.nextEl), i.params.uniqueNavElements && "string" == typeof a.nextEl && e.length > 1 && 1 === i.$el.find(a.nextEl).length && (e = i.$el.find(a.nextEl))), a.prevEl && (t = s(a.prevEl), i.params.uniqueNavElements && "string" == typeof a.prevEl && t.length > 1 && 1 === i.$el.find(a.prevEl).length && (t = i.$el.find(a.prevEl))), e && e.length > 0 && e.on("click", function (e) {
					e.preventDefault(), i.isEnd && !i.params.loop || i.slideNext()
				}), t && t.length > 0 && t.on("click", function (e) {
					e.preventDefault(), i.isBeginning && !i.params.loop || i.slidePrev()
				}), d.extend(i.navigation, {
					$nextEl: e,
					nextEl: e && e[0],
					$prevEl: t,
					prevEl: t && t[0]
				}))
			},
			destroy: function () {
				var e = this.navigation,
					t = e.$nextEl,
					i = e.$prevEl;
				t && t.length && (t.off("click"), t.removeClass(this.params.navigation.disabledClass)), i && i.length && (i.off("click"), i.removeClass(this.params.navigation.disabledClass))
			}
		},
		W = {
			update: function () {
				var e = this.rtl,
					t = this.params.pagination;
				if (t.el && this.pagination.el && this.pagination.$el && 0 !== this.pagination.$el.length) {
					var i, a = this.virtual && this.params.virtual.enabled ? this.virtual.slides.length : this.slides.length,
						r = this.pagination.$el,
						n = this.params.loop ? Math.ceil((a - 2 * this.loopedSlides) / this.params.slidesPerGroup) : this.snapGrid.length;
					if (this.params.loop ? ((i = Math.ceil((this.activeIndex - this.loopedSlides) / this.params.slidesPerGroup)) > a - 1 - 2 * this.loopedSlides && (i -= a - 2 * this.loopedSlides), i > n - 1 && (i -= n), i < 0 && "bullets" !== this.params.paginationType && (i = n + i)) : i = void 0 !== this.snapIndex ? this.snapIndex : this.activeIndex || 0, "bullets" === t.type && this.pagination.bullets && this.pagination.bullets.length > 0) {
						var o, l, d, h = this.pagination.bullets;
						if (t.dynamicBullets && (this.pagination.bulletSize = h.eq(0)[this.isHorizontal() ? "outerWidth" : "outerHeight"](!0), r.css(this.isHorizontal() ? "width" : "height", this.pagination.bulletSize * (t.dynamicMainBullets + 4) + "px"), t.dynamicMainBullets > 1 && void 0 !== this.previousIndex && (i > this.previousIndex && this.pagination.dynamicBulletIndex < t.dynamicMainBullets - 1 ? this.pagination.dynamicBulletIndex += 1 : i < this.previousIndex && this.pagination.dynamicBulletIndex > 0 && (this.pagination.dynamicBulletIndex -= 1)), o = i - this.pagination.dynamicBulletIndex, d = ((l = o + (t.dynamicMainBullets - 1)) + o) / 2), h.removeClass(t.bulletActiveClass + " " + t.bulletActiveClass + "-next " + t.bulletActiveClass + "-next-next " + t.bulletActiveClass + "-prev " + t.bulletActiveClass + "-prev-prev " + t.bulletActiveClass + "-main"), r.length > 1) h.each(function (e, a) {
							var r = s(a),
								n = r.index();
							n === i && r.addClass(t.bulletActiveClass), t.dynamicBullets && (n >= o && n <= l && r.addClass(t.bulletActiveClass + "-main"), n === o && r.prev().addClass(t.bulletActiveClass + "-prev").prev().addClass(t.bulletActiveClass + "-prev-prev"), n === l && r.next().addClass(t.bulletActiveClass + "-next").next().addClass(t.bulletActiveClass + "-next-next"))
						});
						else if (h.eq(i).addClass(t.bulletActiveClass), t.dynamicBullets) {
							for (var p = h.eq(o), c = h.eq(l), u = o; u <= l; u += 1) h.eq(u).addClass(t.bulletActiveClass + "-main");
							p.prev().addClass(t.bulletActiveClass + "-prev").prev().addClass(t.bulletActiveClass + "-prev-prev"), c.next().addClass(t.bulletActiveClass + "-next").next().addClass(t.bulletActiveClass + "-next-next")
						}
						if (t.dynamicBullets) {
							var v = Math.min(h.length, t.dynamicMainBullets + 4),
								f = (this.pagination.bulletSize * v - this.pagination.bulletSize) / 2 - d * this.pagination.bulletSize,
								m = e ? "right" : "left";
							h.css(this.isHorizontal() ? m : "top", f + "px")
						}
					}
					if ("fraction" === t.type && (r.find("." + t.currentClass).text(i + 1), r.find("." + t.totalClass).text(n)), "progressbar" === t.type) {
						var g = (i + 1) / n,
							b = g,
							w = 1;
						this.isHorizontal() || (w = g, b = 1), r.find("." + t.progressbarFillClass).transform("translate3d(0,0,0) scaleX(" + b + ") scaleY(" + w + ")").transition(this.params.speed)
					}
					"custom" === t.type && t.renderCustom ? (r.html(t.renderCustom(this, i + 1, n)), this.emit("paginationRender", this, r[0])) : this.emit("paginationUpdate", this, r[0]), r[this.params.watchOverflow && this.isLocked ? "addClass" : "removeClass"](t.lockClass)
				}
			},
			render: function () {
				var e = this.params.pagination;
				if (e.el && this.pagination.el && this.pagination.$el && 0 !== this.pagination.$el.length) {
					var t = this.virtual && this.params.virtual.enabled ? this.virtual.slides.length : this.slides.length,
						i = this.pagination.$el,
						s = "";
					if ("bullets" === e.type) {
						for (var a = this.params.loop ? Math.ceil((t - 2 * this.loopedSlides) / this.params.slidesPerGroup) : this.snapGrid.length, r = 0; r < a; r += 1) e.renderBullet ? s += e.renderBullet.call(this, r, e.bulletClass) : s += "<" + e.bulletElement + ' class="' + e.bulletClass + '"></' + e.bulletElement + ">";
						i.html(s), this.pagination.bullets = i.find("." + e.bulletClass)
					}
					"fraction" === e.type && (s = e.renderFraction ? e.renderFraction.call(this, e.currentClass, e.totalClass) : '<span class="' + e.currentClass + '"></span> / <span class="' + e.totalClass + '"></span>', i.html(s)), "progressbar" === e.type && (s = e.renderProgressbar ? e.renderProgressbar.call(this, e.progressbarFillClass) : '<span class="' + e.progressbarFillClass + '"></span>', i.html(s)), "custom" !== e.type && this.emit("paginationRender", this.pagination.$el[0])
				}
			},
			init: function () {
				var e = this,
					t = e.params.pagination;
				if (t.el) {
					var i = s(t.el);
					0 !== i.length && (e.params.uniqueNavElements && "string" == typeof t.el && i.length > 1 && 1 === e.$el.find(t.el).length && (i = e.$el.find(t.el)), "bullets" === t.type && t.clickable && i.addClass(t.clickableClass), i.addClass(t.modifierClass + t.type), "bullets" === t.type && t.dynamicBullets && (i.addClass("" + t.modifierClass + t.type + "-dynamic"), e.pagination.dynamicBulletIndex = 0, t.dynamicMainBullets < 1 && (t.dynamicMainBullets = 1)), t.clickable && i.on("click", "." + t.bulletClass, function (t) {
						t.preventDefault();
						var i = s(this).index() * e.params.slidesPerGroup;
						e.params.loop && (i += e.loopedSlides), e.slideTo(i)
					}), d.extend(e.pagination, {
						$el: i,
						el: i[0]
					}))
				}
			},
			destroy: function () {
				var e = this.params.pagination;
				if (e.el && this.pagination.el && this.pagination.$el && 0 !== this.pagination.$el.length) {
					var t = this.pagination.$el;
					t.removeClass(e.hiddenClass), t.removeClass(e.modifierClass + e.type), this.pagination.bullets && this.pagination.bullets.removeClass(e.bulletActiveClass), e.clickable && t.off("click", "." + e.bulletClass)
				}
			}
		},
		q = {
			setTranslate: function () {
				if (this.params.scrollbar.el && this.scrollbar.el) {
					var e = this.scrollbar,
						t = this.rtl,
						i = this.progress,
						s = e.dragSize,
						a = e.trackSize,
						r = e.$dragEl,
						n = e.$el,
						o = this.params.scrollbar,
						l = s,
						d = (a - s) * i;
					t && this.isHorizontal() ? (d = -d) > 0 ? (l = s - d, d = 0) : -d + s > a && (l = a + d) : d < 0 ? (l = s + d, d = 0) : d + s > a && (l = a - d), this.isHorizontal() ? (h.transforms3d ? r.transform("translate3d(" + d + "px, 0, 0)") : r.transform("translateX(" + d + "px)"), r[0].style.width = l + "px") : (h.transforms3d ? r.transform("translate3d(0px, " + d + "px, 0)") : r.transform("translateY(" + d + "px)"), r[0].style.height = l + "px"), o.hide && (clearTimeout(this.scrollbar.timeout), n[0].style.opacity = 1, this.scrollbar.timeout = setTimeout(function () {
						n[0].style.opacity = 0, n.transition(400)
					}, 1e3))
				}
			},
			setTransition: function (e) {
				this.params.scrollbar.el && this.scrollbar.el && this.scrollbar.$dragEl.transition(e)
			},
			updateSize: function () {
				if (this.params.scrollbar.el && this.scrollbar.el) {
					var e = this.scrollbar,
						t = e.$dragEl,
						i = e.$el;
					t[0].style.width = "", t[0].style.height = "";
					var s, a = this.isHorizontal() ? i[0].offsetWidth : i[0].offsetHeight,
						r = this.size / this.virtualSize,
						n = r * (a / this.size);
					s = "auto" === this.params.scrollbar.dragSize ? a * r : parseInt(this.params.scrollbar.dragSize, 10), this.isHorizontal() ? t[0].style.width = s + "px" : t[0].style.height = s + "px", i[0].style.display = r >= 1 ? "none" : "", this.params.scrollbarHide && (i[0].style.opacity = 0), d.extend(e, {
						trackSize: a,
						divider: r,
						moveDivider: n,
						dragSize: s
					}), e.$el[this.params.watchOverflow && this.isLocked ? "addClass" : "removeClass"](this.params.scrollbar.lockClass)
				}
			},
			setDragPosition: function (e) {
				var t, i = this.scrollbar,
					s = i.$el,
					a = i.dragSize,
					r = i.trackSize;
				t = ((this.isHorizontal() ? "touchstart" === e.type || "touchmove" === e.type ? e.targetTouches[0].pageX : e.pageX || e.clientX : "touchstart" === e.type || "touchmove" === e.type ? e.targetTouches[0].pageY : e.pageY || e.clientY) - s.offset()[this.isHorizontal() ? "left" : "top"] - a / 2) / (r - a), t = Math.max(Math.min(t, 1), 0), this.rtl && (t = 1 - t);
				var n = this.minTranslate() + (this.maxTranslate() - this.minTranslate()) * t;
				this.updateProgress(n), this.setTranslate(n), this.updateActiveIndex(), this.updateSlidesClasses()
			},
			onDragStart: function (e) {
				var t = this.params.scrollbar,
					i = this.scrollbar,
					s = this.$wrapperEl,
					a = i.$el,
					r = i.$dragEl;
				this.scrollbar.isTouched = !0, e.preventDefault(), e.stopPropagation(), s.transition(100), r.transition(100), i.setDragPosition(e), clearTimeout(this.scrollbar.dragTimeout), a.transition(0), t.hide && a.css("opacity", 1), this.emit("scrollbarDragStart", e)
			},
			onDragMove: function (e) {
				var t = this.scrollbar,
					i = this.$wrapperEl,
					s = t.$el,
					a = t.$dragEl;
				this.scrollbar.isTouched && (e.preventDefault ? e.preventDefault() : e.returnValue = !1, t.setDragPosition(e), i.transition(0), s.transition(0), a.transition(0), this.emit("scrollbarDragMove", e))
			},
			onDragEnd: function (e) {
				var t = this.params.scrollbar,
					i = this.scrollbar.$el;
				this.scrollbar.isTouched && (this.scrollbar.isTouched = !1, t.hide && (clearTimeout(this.scrollbar.dragTimeout), this.scrollbar.dragTimeout = d.nextTick(function () {
					i.css("opacity", 0), i.transition(400)
				}, 1e3)), this.emit("scrollbarDragEnd", e), t.snapOnRelease && this.slideReset())
			},
			enableDraggable: function () {
				if (this.params.scrollbar.el) {
					var t = this.scrollbar,
						i = this.touchEvents,
						s = this.touchEventsDesktop,
						a = this.params,
						r = t.$el[0],
						n = !(!h.passiveListener || !a.passiveListener) && {
							passive: !1,
							capture: !1
						},
						o = !(!h.passiveListener || !a.passiveListener) && {
							passive: !0,
							capture: !1
						};
					h.touch || !h.pointerEvents && !h.prefixedPointerEvents ? (h.touch && (r.addEventListener(i.start, this.scrollbar.onDragStart, n), r.addEventListener(i.move, this.scrollbar.onDragMove, n), r.addEventListener(i.end, this.scrollbar.onDragEnd, o)), (a.simulateTouch && !y.ios && !y.android || a.simulateTouch && !h.touch && y.ios) && (r.addEventListener("mousedown", this.scrollbar.onDragStart, n), e.addEventListener("mousemove", this.scrollbar.onDragMove, n), e.addEventListener("mouseup", this.scrollbar.onDragEnd, o))) : (r.addEventListener(s.start, this.scrollbar.onDragStart, n), e.addEventListener(s.move, this.scrollbar.onDragMove, n), e.addEventListener(s.end, this.scrollbar.onDragEnd, o))
				}
			},
			disableDraggable: function () {
				if (this.params.scrollbar.el) {
					var t = this.scrollbar,
						i = this.touchEvents,
						s = this.touchEventsDesktop,
						a = this.params,
						r = t.$el[0],
						n = !(!h.passiveListener || !a.passiveListener) && {
							passive: !1,
							capture: !1
						},
						o = !(!h.passiveListener || !a.passiveListener) && {
							passive: !0,
							capture: !1
						};
					h.touch || !h.pointerEvents && !h.prefixedPointerEvents ? (h.touch && (r.removeEventListener(i.start, this.scrollbar.onDragStart, n), r.removeEventListener(i.move, this.scrollbar.onDragMove, n), r.removeEventListener(i.end, this.scrollbar.onDragEnd, o)), (a.simulateTouch && !y.ios && !y.android || a.simulateTouch && !h.touch && y.ios) && (r.removeEventListener("mousedown", this.scrollbar.onDragStart, n), e.removeEventListener("mousemove", this.scrollbar.onDragMove, n), e.removeEventListener("mouseup", this.scrollbar.onDragEnd, o))) : (r.removeEventListener(s.start, this.scrollbar.onDragStart, n), e.removeEventListener(s.move, this.scrollbar.onDragMove, n), e.removeEventListener(s.end, this.scrollbar.onDragEnd, o))
				}
			},
			init: function () {
				if (this.params.scrollbar.el) {
					var e = this.scrollbar,
						t = this.$el,
						i = this.params.scrollbar,
						a = s(i.el);
					this.params.uniqueNavElements && "string" == typeof i.el && a.length > 1 && 1 === t.find(i.el).length && (a = t.find(i.el));
					var r = a.find("." + this.params.scrollbar.dragClass);
					0 === r.length && (r = s('<div class="' + this.params.scrollbar.dragClass + '"></div>'), a.append(r)), d.extend(e, {
						$el: a,
						el: a[0],
						$dragEl: r,
						dragEl: r[0]
					}), i.draggable && e.enableDraggable()
				}
			},
			destroy: function () {
				this.scrollbar.disableDraggable()
			}
		},
		j = {
			setTransform: function (e, t) {
				var i = this.rtl,
					a = s(e),
					r = i ? -1 : 1,
					n = a.attr("data-swiper-parallax") || "0",
					o = a.attr("data-swiper-parallax-x"),
					l = a.attr("data-swiper-parallax-y"),
					d = a.attr("data-swiper-parallax-scale"),
					h = a.attr("data-swiper-parallax-opacity");
				if (o || l ? (o = o || "0", l = l || "0") : this.isHorizontal() ? (o = n, l = "0") : (l = n, o = "0"), o = o.indexOf("%") >= 0 ? parseInt(o, 10) * t * r + "%" : o * t * r + "px", l = l.indexOf("%") >= 0 ? parseInt(l, 10) * t + "%" : l * t + "px", void 0 !== h && null !== h) {
					var p = h - (h - 1) * (1 - Math.abs(t));
					a[0].style.opacity = p
				}
				if (void 0 === d || null === d) a.transform("translate3d(" + o + ", " + l + ", 0px)");
				else {
					var c = d - (d - 1) * (1 - Math.abs(t));
					a.transform("translate3d(" + o + ", " + l + ", 0px) scale(" + c + ")")
				}
			},
			setTranslate: function () {
				var e = this,
					t = e.$el,
					i = e.slides,
					a = e.progress,
					r = e.snapGrid;
				t.children("[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y]").each(function (t, i) {
					e.parallax.setTransform(i, a)
				}), i.each(function (t, i) {
					var n = i.progress;
					e.params.slidesPerGroup > 1 && "auto" !== e.params.slidesPerView && (n += Math.ceil(t / 2) - a * (r.length - 1)), n = Math.min(Math.max(n, -1), 1), s(i).find("[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y]").each(function (t, i) {
						e.parallax.setTransform(i, n)
					})
				})
			},
			setTransition: function (e) {
				void 0 === e && (e = this.params.speed);
				this.$el.find("[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y]").each(function (t, i) {
					var a = s(i),
						r = parseInt(a.attr("data-swiper-parallax-duration"), 10) || e;
					0 === e && (r = 0), a.transition(r)
				})
			}
		},
		K = {
			getDistanceBetweenTouches: function (e) {
				if (e.targetTouches.length < 2) return 1;
				var t = e.targetTouches[0].pageX,
					i = e.targetTouches[0].pageY,
					s = e.targetTouches[1].pageX,
					a = e.targetTouches[1].pageY;
				return Math.sqrt(Math.pow(s - t, 2) + Math.pow(a - i, 2))
			},
			onGestureStart: function (e) {
				var t = this.params.zoom,
					i = this.zoom,
					a = i.gesture;
				if (i.fakeGestureTouched = !1, i.fakeGestureMoved = !1, !h.gestures) {
					if ("touchstart" !== e.type || "touchstart" === e.type && e.targetTouches.length < 2) return;
					i.fakeGestureTouched = !0, a.scaleStart = K.getDistanceBetweenTouches(e)
				}
				a.$slideEl && a.$slideEl.length || (a.$slideEl = s(e.target).closest(".swiper-slide"), 0 === a.$slideEl.length && (a.$slideEl = this.slides.eq(this.activeIndex)), a.$imageEl = a.$slideEl.find("img, svg, canvas"), a.$imageWrapEl = a.$imageEl.parent("." + t.containerClass), a.maxRatio = a.$imageWrapEl.attr("data-swiper-zoom") || t.maxRatio, 0 !== a.$imageWrapEl.length) ? (a.$imageEl.transition(0), this.zoom.isScaling = !0) : a.$imageEl = void 0
			},
			onGestureChange: function (e) {
				var t = this.params.zoom,
					i = this.zoom,
					s = i.gesture;
				if (!h.gestures) {
					if ("touchmove" !== e.type || "touchmove" === e.type && e.targetTouches.length < 2) return;
					i.fakeGestureMoved = !0, s.scaleMove = K.getDistanceBetweenTouches(e)
				}
				s.$imageEl && 0 !== s.$imageEl.length && (h.gestures ? this.zoom.scale = e.scale * i.currentScale : i.scale = s.scaleMove / s.scaleStart * i.currentScale, i.scale > s.maxRatio && (i.scale = s.maxRatio - 1 + Math.pow(i.scale - s.maxRatio + 1, .5)), i.scale < t.minRatio && (i.scale = t.minRatio + 1 - Math.pow(t.minRatio - i.scale + 1, .5)), s.$imageEl.transform("translate3d(0,0,0) scale(" + i.scale + ")"))
			},
			onGestureEnd: function (e) {
				var t = this.params.zoom,
					i = this.zoom,
					s = i.gesture;
				if (!h.gestures) {
					if (!i.fakeGestureTouched || !i.fakeGestureMoved) return;
					if ("touchend" !== e.type || "touchend" === e.type && e.changedTouches.length < 2 && !y.android) return;
					i.fakeGestureTouched = !1, i.fakeGestureMoved = !1
				}
				s.$imageEl && 0 !== s.$imageEl.length && (i.scale = Math.max(Math.min(i.scale, s.maxRatio), t.minRatio), s.$imageEl.transition(this.params.speed).transform("translate3d(0,0,0) scale(" + i.scale + ")"), i.currentScale = i.scale, i.isScaling = !1, 1 === i.scale && (s.$slideEl = void 0))
			},
			onTouchStart: function (e) {
				var t = this.zoom,
					i = t.gesture,
					s = t.image;
				i.$imageEl && 0 !== i.$imageEl.length && (s.isTouched || (y.android && e.preventDefault(), s.isTouched = !0, s.touchesStart.x = "touchstart" === e.type ? e.targetTouches[0].pageX : e.pageX, s.touchesStart.y = "touchstart" === e.type ? e.targetTouches[0].pageY : e.pageY))
			},
			onTouchMove: function (e) {
				var t = this.zoom,
					i = t.gesture,
					s = t.image,
					a = t.velocity;
				if (i.$imageEl && 0 !== i.$imageEl.length && (this.allowClick = !1, s.isTouched && i.$slideEl)) {
					s.isMoved || (s.width = i.$imageEl[0].offsetWidth, s.height = i.$imageEl[0].offsetHeight, s.startX = d.getTranslate(i.$imageWrapEl[0], "x") || 0, s.startY = d.getTranslate(i.$imageWrapEl[0], "y") || 0, i.slideWidth = i.$slideEl[0].offsetWidth, i.slideHeight = i.$slideEl[0].offsetHeight, i.$imageWrapEl.transition(0), this.rtl && (s.startX = -s.startX), this.rtl && (s.startY = -s.startY));
					var r = s.width * t.scale,
						n = s.height * t.scale;
					if (!(r < i.slideWidth && n < i.slideHeight)) {
						if (s.minX = Math.min(i.slideWidth / 2 - r / 2, 0), s.maxX = -s.minX, s.minY = Math.min(i.slideHeight / 2 - n / 2, 0), s.maxY = -s.minY, s.touchesCurrent.x = "touchmove" === e.type ? e.targetTouches[0].pageX : e.pageX, s.touchesCurrent.y = "touchmove" === e.type ? e.targetTouches[0].pageY : e.pageY, !s.isMoved && !t.isScaling) {
							if (this.isHorizontal() && (Math.floor(s.minX) === Math.floor(s.startX) && s.touchesCurrent.x < s.touchesStart.x || Math.floor(s.maxX) === Math.floor(s.startX) && s.touchesCurrent.x > s.touchesStart.x)) return void(s.isTouched = !1);
							if (!this.isHorizontal() && (Math.floor(s.minY) === Math.floor(s.startY) && s.touchesCurrent.y < s.touchesStart.y || Math.floor(s.maxY) === Math.floor(s.startY) && s.touchesCurrent.y > s.touchesStart.y)) return void(s.isTouched = !1)
						}
						e.preventDefault(), e.stopPropagation(), s.isMoved = !0, s.currentX = s.touchesCurrent.x - s.touchesStart.x + s.startX, s.currentY = s.touchesCurrent.y - s.touchesStart.y + s.startY, s.currentX < s.minX && (s.currentX = s.minX + 1 - Math.pow(s.minX - s.currentX + 1, .8)), s.currentX > s.maxX && (s.currentX = s.maxX - 1 + Math.pow(s.currentX - s.maxX + 1, .8)), s.currentY < s.minY && (s.currentY = s.minY + 1 - Math.pow(s.minY - s.currentY + 1, .8)), s.currentY > s.maxY && (s.currentY = s.maxY - 1 + Math.pow(s.currentY - s.maxY + 1, .8)), a.prevPositionX || (a.prevPositionX = s.touchesCurrent.x), a.prevPositionY || (a.prevPositionY = s.touchesCurrent.y), a.prevTime || (a.prevTime = Date.now()), a.x = (s.touchesCurrent.x - a.prevPositionX) / (Date.now() - a.prevTime) / 2, a.y = (s.touchesCurrent.y - a.prevPositionY) / (Date.now() - a.prevTime) / 2, Math.abs(s.touchesCurrent.x - a.prevPositionX) < 2 && (a.x = 0), Math.abs(s.touchesCurrent.y - a.prevPositionY) < 2 && (a.y = 0), a.prevPositionX = s.touchesCurrent.x, a.prevPositionY = s.touchesCurrent.y, a.prevTime = Date.now(), i.$imageWrapEl.transform("translate3d(" + s.currentX + "px, " + s.currentY + "px,0)")
					}
				}
			},
			onTouchEnd: function () {
				var e = this.zoom,
					t = e.gesture,
					i = e.image,
					s = e.velocity;
				if (t.$imageEl && 0 !== t.$imageEl.length) {
					if (!i.isTouched || !i.isMoved) return i.isTouched = !1, void(i.isMoved = !1);
					i.isTouched = !1, i.isMoved = !1;
					var a = 300,
						r = 300,
						n = s.x * a,
						o = i.currentX + n,
						l = s.y * r,
						d = i.currentY + l;
					0 !== s.x && (a = Math.abs((o - i.currentX) / s.x)), 0 !== s.y && (r = Math.abs((d - i.currentY) / s.y));
					var h = Math.max(a, r);
					i.currentX = o, i.currentY = d;
					var p = i.width * e.scale,
						c = i.height * e.scale;
					i.minX = Math.min(t.slideWidth / 2 - p / 2, 0), i.maxX = -i.minX, i.minY = Math.min(t.slideHeight / 2 - c / 2, 0), i.maxY = -i.minY, i.currentX = Math.max(Math.min(i.currentX, i.maxX), i.minX), i.currentY = Math.max(Math.min(i.currentY, i.maxY), i.minY), t.$imageWrapEl.transition(h).transform("translate3d(" + i.currentX + "px, " + i.currentY + "px,0)")
				}
			},
			onTransitionEnd: function () {
				var e = this.zoom,
					t = e.gesture;
				t.$slideEl && this.previousIndex !== this.activeIndex && (t.$imageEl.transform("translate3d(0,0,0) scale(1)"), t.$imageWrapEl.transform("translate3d(0,0,0)"), t.$slideEl = void 0, t.$imageEl = void 0, t.$imageWrapEl = void 0, e.scale = 1, e.currentScale = 1)
			},
			toggle: function (e) {
				var t = this.zoom;
				t.scale && 1 !== t.scale ? t.out() : t.in(e)
			},
			in: function (e) {
				var t, i, a, r, n, o, l, d, h, p, c, u, v, f, m, g, b = this.zoom,
					w = this.params.zoom,
					y = b.gesture,
					x = b.image;
				(y.$slideEl || (y.$slideEl = this.clickedSlide ? s(this.clickedSlide) : this.slides.eq(this.activeIndex), y.$imageEl = y.$slideEl.find("img, svg, canvas"), y.$imageWrapEl = y.$imageEl.parent("." + w.containerClass)), y.$imageEl && 0 !== y.$imageEl.length) && (y.$slideEl.addClass("" + w.zoomedSlideClass), void 0 === x.touchesStart.x && e ? (t = "touchend" === e.type ? e.changedTouches[0].pageX : e.pageX, i = "touchend" === e.type ? e.changedTouches[0].pageY : e.pageY) : (t = x.touchesStart.x, i = x.touchesStart.y), b.scale = y.$imageWrapEl.attr("data-swiper-zoom") || w.maxRatio, b.currentScale = y.$imageWrapEl.attr("data-swiper-zoom") || w.maxRatio, e ? (m = y.$slideEl[0].offsetWidth, g = y.$slideEl[0].offsetHeight, a = y.$slideEl.offset().left + m / 2 - t, r = y.$slideEl.offset().top + g / 2 - i, l = y.$imageEl[0].offsetWidth, d = y.$imageEl[0].offsetHeight, h = l * b.scale, p = d * b.scale, v = -(c = Math.min(m / 2 - h / 2, 0)), f = -(u = Math.min(g / 2 - p / 2, 0)), n = a * b.scale, o = r * b.scale, n < c && (n = c), n > v && (n = v), o < u && (o = u), o > f && (o = f)) : (n = 0, o = 0), y.$imageWrapEl.transition(300).transform("translate3d(" + n + "px, " + o + "px,0)"), y.$imageEl.transition(300).transform("translate3d(0,0,0) scale(" + b.scale + ")"))
			},
			out: function () {
				var e = this.zoom,
					t = this.params.zoom,
					i = e.gesture;
				i.$slideEl || (i.$slideEl = this.clickedSlide ? s(this.clickedSlide) : this.slides.eq(this.activeIndex), i.$imageEl = i.$slideEl.find("img, svg, canvas"), i.$imageWrapEl = i.$imageEl.parent("." + t.containerClass)), i.$imageEl && 0 !== i.$imageEl.length && (e.scale = 1, e.currentScale = 1, i.$imageWrapEl.transition(300).transform("translate3d(0,0,0)"), i.$imageEl.transition(300).transform("translate3d(0,0,0) scale(1)"), i.$slideEl.removeClass("" + t.zoomedSlideClass), i.$slideEl = void 0)
			},
			enable: function () {
				var e = this.zoom;
				if (!e.enabled) {
					e.enabled = !0;
					var t = !("touchstart" !== this.touchEvents.start || !h.passiveListener || !this.params.passiveListeners) && {
						passive: !0,
						capture: !1
					};
					h.gestures ? (this.$wrapperEl.on("gesturestart", ".swiper-slide", e.onGestureStart, t), this.$wrapperEl.on("gesturechange", ".swiper-slide", e.onGestureChange, t), this.$wrapperEl.on("gestureend", ".swiper-slide", e.onGestureEnd, t)) : "touchstart" === this.touchEvents.start && (this.$wrapperEl.on(this.touchEvents.start, ".swiper-slide", e.onGestureStart, t), this.$wrapperEl.on(this.touchEvents.move, ".swiper-slide", e.onGestureChange, t), this.$wrapperEl.on(this.touchEvents.end, ".swiper-slide", e.onGestureEnd, t)), this.$wrapperEl.on(this.touchEvents.move, "." + this.params.zoom.containerClass, e.onTouchMove)
				}
			},
			disable: function () {
				var e = this.zoom;
				if (e.enabled) {
					this.zoom.enabled = !1;
					var t = !("touchstart" !== this.touchEvents.start || !h.passiveListener || !this.params.passiveListeners) && {
						passive: !0,
						capture: !1
					};
					h.gestures ? (this.$wrapperEl.off("gesturestart", ".swiper-slide", e.onGestureStart, t), this.$wrapperEl.off("gesturechange", ".swiper-slide", e.onGestureChange, t), this.$wrapperEl.off("gestureend", ".swiper-slide", e.onGestureEnd, t)) : "touchstart" === this.touchEvents.start && (this.$wrapperEl.off(this.touchEvents.start, ".swiper-slide", e.onGestureStart, t), this.$wrapperEl.off(this.touchEvents.move, ".swiper-slide", e.onGestureChange, t), this.$wrapperEl.off(this.touchEvents.end, ".swiper-slide", e.onGestureEnd, t)), this.$wrapperEl.off(this.touchEvents.move, "." + this.params.zoom.containerClass, e.onTouchMove)
				}
			}
		},
		U = {
			loadInSlide: function (e, t) {
				void 0 === t && (t = !0);
				var i = this,
					a = i.params.lazy;
				if (void 0 !== e && 0 !== i.slides.length) {
					var r = i.virtual && i.params.virtual.enabled ? i.$wrapperEl.children("." + i.params.slideClass + '[data-swiper-slide-index="' + e + '"]') : i.slides.eq(e),
						n = r.find("." + a.elementClass + ":not(." + a.loadedClass + "):not(." + a.loadingClass + ")");
					!r.hasClass(a.elementClass) || r.hasClass(a.loadedClass) || r.hasClass(a.loadingClass) || (n = n.add(r[0])), 0 !== n.length && n.each(function (e, n) {
						var o = s(n);
						o.addClass(a.loadingClass);
						var l = o.attr("data-background"),
							d = o.attr("data-src"),
							h = o.attr("data-srcset"),
							p = o.attr("data-sizes");
						i.loadImage(o[0], d || l, h, p, !1, function () {
							if (void 0 !== i && null !== i && i && (!i || i.params) && !i.destroyed) {
								if (l ? (o.css("background-image", 'url("' + l + '")'), o.removeAttr("data-background")) : (h && (o.attr("srcset", h), o.removeAttr("data-srcset")), p && (o.attr("sizes", p), o.removeAttr("data-sizes")), d && (o.attr("src", d), o.removeAttr("data-src"))), o.addClass(a.loadedClass).removeClass(a.loadingClass), r.find("." + a.preloaderClass).remove(), i.params.loop && t) {
									var e = r.attr("data-swiper-slide-index");
									if (r.hasClass(i.params.slideDuplicateClass)) {
										var s = i.$wrapperEl.children('[data-swiper-slide-index="' + e + '"]:not(.' + i.params.slideDuplicateClass + ")");
										i.lazy.loadInSlide(s.index(), !1)
									} else {
										var n = i.$wrapperEl.children("." + i.params.slideDuplicateClass + '[data-swiper-slide-index="' + e + '"]');
										i.lazy.loadInSlide(n.index(), !1)
									}
								}
								i.emit("lazyImageReady", r[0], o[0])
							}
						}), i.emit("lazyImageLoad", r[0], o[0])
					})
				}
			},
			load: function () {
				var e = this,
					t = e.$wrapperEl,
					i = e.params,
					a = e.slides,
					r = e.activeIndex,
					n = e.virtual && i.virtual.enabled,
					o = i.lazy,
					l = i.slidesPerView;

				function d(e) {
					if (n) {
						if (t.children("." + i.slideClass + '[data-swiper-slide-index="' + e + '"]').length) return !0
					} else if (a[e]) return !0;
					return !1
				}

				function h(e) {
					return n ? s(e).attr("data-swiper-slide-index") : s(e).index()
				}
				if ("auto" === l && (l = 0), e.lazy.initialImageLoaded || (e.lazy.initialImageLoaded = !0), e.params.watchSlidesVisibility) t.children("." + i.slideVisibleClass).each(function (t, i) {
					var a = n ? s(i).attr("data-swiper-slide-index") : s(i).index();
					e.lazy.loadInSlide(a)
				});
				else if (l > 1)
					for (var p = r; p < r + l; p += 1) d(p) && e.lazy.loadInSlide(p);
				else e.lazy.loadInSlide(r);
				if (o.loadPrevNext)
					if (l > 1 || o.loadPrevNextAmount && o.loadPrevNextAmount > 1) {
						for (var c = o.loadPrevNextAmount, u = l, v = Math.min(r + u + Math.max(c, u), a.length), f = Math.max(r - Math.max(u, c), 0), m = r + l; m < v; m += 1) d(m) && e.lazy.loadInSlide(m);
						for (var g = f; g < r; g += 1) d(g) && e.lazy.loadInSlide(g)
					} else {
						var b = t.children("." + i.slideNextClass);
						b.length > 0 && e.lazy.loadInSlide(h(b));
						var w = t.children("." + i.slidePrevClass);
						w.length > 0 && e.lazy.loadInSlide(h(w))
					}
			}
		},
		_ = {
			LinearSpline: function (e, t) {
				var i, s, a, r, n, o = function (e, t) {
					for (s = -1, i = e.length; i - s > 1;) e[a = i + s >> 1] <= t ? s = a : i = a;
					return i
				};
				return this.x = e, this.y = t, this.lastIndex = e.length - 1, this.interpolate = function (e) {
					return e ? (n = o(this.x, e), r = n - 1, (e - this.x[r]) * (this.y[n] - this.y[r]) / (this.x[n] - this.x[r]) + this.y[r]) : 0
				}, this
			},
			getInterpolateFunction: function (e) {
				this.controller.spline || (this.controller.spline = this.params.loop ? new _.LinearSpline(this.slidesGrid, e.slidesGrid) : new _.LinearSpline(this.snapGrid, e.snapGrid))
			},
			setTranslate: function (e, t) {
				var i, s, a = this,
					r = a.controller.control;

				function n(e) {
					var t = e.rtl && "horizontal" === e.params.direction ? -a.translate : a.translate;
					"slide" === a.params.controller.by && (a.controller.getInterpolateFunction(e), s = -a.controller.spline.interpolate(-t)), s && "container" !== a.params.controller.by || (i = (e.maxTranslate() - e.minTranslate()) / (a.maxTranslate() - a.minTranslate()), s = (t - a.minTranslate()) * i + e.minTranslate()), a.params.controller.inverse && (s = e.maxTranslate() - s), e.updateProgress(s), e.setTranslate(s, a), e.updateActiveIndex(), e.updateSlidesClasses()
				}
				if (Array.isArray(r))
					for (var o = 0; o < r.length; o += 1) r[o] !== t && r[o] instanceof I && n(r[o]);
				else r instanceof I && t !== r && n(r)
			},
			setTransition: function (e, t) {
				var i, s = this,
					a = s.controller.control;

				function r(t) {
					t.setTransition(e, s), 0 !== e && (t.transitionStart(), t.$wrapperEl.transitionEnd(function () {
						a && (t.params.loop && "slide" === s.params.controller.by && t.loopFix(), t.transitionEnd())
					}))
				}
				if (Array.isArray(a))
					for (i = 0; i < a.length; i += 1) a[i] !== t && a[i] instanceof I && r(a[i]);
				else a instanceof I && t !== a && r(a)
			}
		},
		Z = {
			makeElFocusable: function (e) {
				return e.attr("tabIndex", "0"), e
			},
			addElRole: function (e, t) {
				return e.attr("role", t), e
			},
			addElLabel: function (e, t) {
				return e.attr("aria-label", t), e
			},
			disableEl: function (e) {
				return e.attr("aria-disabled", !0), e
			},
			enableEl: function (e) {
				return e.attr("aria-disabled", !1), e
			},
			onEnterKey: function (e) {
				var t = this.params.a11y;
				if (13 === e.keyCode) {
					var i = s(e.target);
					this.navigation && this.navigation.$nextEl && i.is(this.navigation.$nextEl) && (this.isEnd && !this.params.loop || this.slideNext(), this.isEnd ? this.a11y.notify(t.lastSlideMessage) : this.a11y.notify(t.nextSlideMessage)), this.navigation && this.navigation.$prevEl && i.is(this.navigation.$prevEl) && (this.isBeginning && !this.params.loop || this.slidePrev(), this.isBeginning ? this.a11y.notify(t.firstSlideMessage) : this.a11y.notify(t.prevSlideMessage)), this.pagination && i.is("." + this.params.pagination.bulletClass) && i[0].click()
				}
			},
			notify: function (e) {
				var t = this.a11y.liveRegion;
				0 !== t.length && (t.html(""), t.html(e))
			},
			updateNavigation: function () {
				if (!this.params.loop) {
					var e = this.navigation,
						t = e.$nextEl,
						i = e.$prevEl;
					i && i.length > 0 && (this.isBeginning ? this.a11y.disableEl(i) : this.a11y.enableEl(i)), t && t.length > 0 && (this.isEnd ? this.a11y.disableEl(t) : this.a11y.enableEl(t))
				}
			},
			updatePagination: function () {
				var e = this,
					t = e.params.a11y;
				e.pagination && e.params.pagination.clickable && e.pagination.bullets && e.pagination.bullets.length && e.pagination.bullets.each(function (i, a) {
					var r = s(a);
					e.a11y.makeElFocusable(r), e.a11y.addElRole(r, "button"), e.a11y.addElLabel(r, t.paginationBulletMessage.replace(/{{index}}/, r.index() + 1))
				})
			},
			init: function () {
				this.$el.append(this.a11y.liveRegion);
				var e, t, i = this.params.a11y;
				this.navigation && this.navigation.$nextEl && (e = this.navigation.$nextEl), this.navigation && this.navigation.$prevEl && (t = this.navigation.$prevEl), e && (this.a11y.makeElFocusable(e), this.a11y.addElRole(e, "button"), this.a11y.addElLabel(e, i.nextSlideMessage), e.on("keydown", this.a11y.onEnterKey)), t && (this.a11y.makeElFocusable(t), this.a11y.addElRole(t, "button"), this.a11y.addElLabel(t, i.prevSlideMessage), t.on("keydown", this.a11y.onEnterKey)), this.pagination && this.params.pagination.clickable && this.pagination.bullets && this.pagination.bullets.length && this.pagination.$el.on("keydown", "." + this.params.pagination.bulletClass, this.a11y.onEnterKey)
			},
			destroy: function () {
				var e, t;
				this.a11y.liveRegion && this.a11y.liveRegion.length > 0 && this.a11y.liveRegion.remove(), this.navigation && this.navigation.$nextEl && (e = this.navigation.$nextEl), this.navigation && this.navigation.$prevEl && (t = this.navigation.$prevEl), e && e.off("keydown", this.a11y.onEnterKey), t && t.off("keydown", this.a11y.onEnterKey), this.pagination && this.params.pagination.clickable && this.pagination.bullets && this.pagination.bullets.length && this.pagination.$el.off("keydown", "." + this.params.pagination.bulletClass, this.a11y.onEnterKey)
			}
		},
		Q = {
			init: function () {
				if (this.params.history) {
					if (!t.history || !t.history.pushState) return this.params.history.enabled = !1, void(this.params.hashNavigation.enabled = !0);
					var e = this.history;
					e.initialized = !0, e.paths = Q.getPathValues(), (e.paths.key || e.paths.value) && (e.scrollToSlide(0, e.paths.value, this.params.runCallbacksOnInit), this.params.history.replaceState || t.addEventListener("popstate", this.history.setHistoryPopState))
				}
			},
			destroy: function () {
				this.params.history.replaceState || t.removeEventListener("popstate", this.history.setHistoryPopState)
			},
			setHistoryPopState: function () {
				this.history.paths = Q.getPathValues(), this.history.scrollToSlide(this.params.speed, this.history.paths.value, !1)
			},
			getPathValues: function () {
				var e = t.location.pathname.slice(1).split("/").filter(function (e) {
						return "" !== e
					}),
					i = e.length;
				return {
					key: e[i - 2],
					value: e[i - 1]
				}
			},
			setHistory: function (e, i) {
				if (this.history.initialized && this.params.history.enabled) {
					var s = this.slides.eq(i),
						a = Q.slugify(s.attr("data-history"));
					t.location.pathname.includes(e) || (a = e + "/" + a);
					var r = t.history.state;
					r && r.value === a || (this.params.history.replaceState ? t.history.replaceState({
						value: a
					}, null, a) : t.history.pushState({
						value: a
					}, null, a))
				}
			},
			slugify: function (e) {
				return e.toString().toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]+/g, "").replace(/--+/g, "-").replace(/^-+/, "").replace(/-+$/, "")
			},
			scrollToSlide: function (e, t, i) {
				if (t)
					for (var s = 0, a = this.slides.length; s < a; s += 1) {
						var r = this.slides.eq(s);
						if (Q.slugify(r.attr("data-history")) === t && !r.hasClass(this.params.slideDuplicateClass)) {
							var n = r.index();
							this.slideTo(n, e, i)
						}
					} else this.slideTo(0, e, i)
			}
		},
		J = {
			onHashCange: function () {
				var t = e.location.hash.replace("#", "");
				t !== this.slides.eq(this.activeIndex).attr("data-hash") && this.slideTo(this.$wrapperEl.children("." + this.params.slideClass + '[data-hash="' + t + '"]').index())
			},
			setHash: function () {
				if (this.hashNavigation.initialized && this.params.hashNavigation.enabled)
					if (this.params.hashNavigation.replaceState && t.history && t.history.replaceState) t.history.replaceState(null, null, "#" + this.slides.eq(this.activeIndex).attr("data-hash") || "");
					else {
						var i = this.slides.eq(this.activeIndex),
							s = i.attr("data-hash") || i.attr("data-history");
						e.location.hash = s || ""
					}
			},
			init: function () {
				if (!(!this.params.hashNavigation.enabled || this.params.history && this.params.history.enabled)) {
					this.hashNavigation.initialized = !0;
					var i = e.location.hash.replace("#", "");
					if (i)
						for (var a = 0, r = this.slides.length; a < r; a += 1) {
							var n = this.slides.eq(a);
							if ((n.attr("data-hash") || n.attr("data-history")) === i && !n.hasClass(this.params.slideDuplicateClass)) {
								var o = n.index();
								this.slideTo(o, 0, this.params.runCallbacksOnInit, !0)
							}
						}
					this.params.hashNavigation.watchState && s(t).on("hashchange", this.hashNavigation.onHashCange)
				}
			},
			destroy: function () {
				this.params.hashNavigation.watchState && s(t).off("hashchange", this.hashNavigation.onHashCange)
			}
		},
		ee = {
			run: function () {
				var e = this,
					t = e.slides.eq(e.activeIndex),
					i = e.params.autoplay.delay;
				t.attr("data-swiper-autoplay") && (i = t.attr("data-swiper-autoplay") || e.params.autoplay.delay), e.autoplay.timeout = d.nextTick(function () {
					e.params.autoplay.reverseDirection ? e.params.loop ? (e.loopFix(), e.slidePrev(e.params.speed, !0, !0), e.emit("autoplay")) : e.isBeginning ? e.params.autoplay.stopOnLastSlide ? e.autoplay.stop() : (e.slideTo(e.slides.length - 1, e.params.speed, !0, !0), e.emit("autoplay")) : (e.slidePrev(e.params.speed, !0, !0), e.emit("autoplay")) : e.params.loop ? (e.loopFix(), e.slideNext(e.params.speed, !0, !0), e.emit("autoplay")) : e.isEnd ? e.params.autoplay.stopOnLastSlide ? e.autoplay.stop() : (e.slideTo(0, e.params.speed, !0, !0), e.emit("autoplay")) : (e.slideNext(e.params.speed, !0, !0), e.emit("autoplay"))
				}, i)
			},
			start: function () {
				return void 0 === this.autoplay.timeout && (!this.autoplay.running && (this.autoplay.running = !0, this.emit("autoplayStart"), this.autoplay.run(), !0))
			},
			stop: function () {
				return !!this.autoplay.running && (void 0 !== this.autoplay.timeout && (this.autoplay.timeout && (clearTimeout(this.autoplay.timeout), this.autoplay.timeout = void 0), this.autoplay.running = !1, this.emit("autoplayStop"), !0))
			},
			pause: function (e) {
				var t = this;
				t.autoplay.running && (t.autoplay.paused || (t.autoplay.timeout && clearTimeout(t.autoplay.timeout), t.autoplay.paused = !0, 0 !== e && t.params.autoplay.waitForTransition ? t.$wrapperEl.transitionEnd(function () {
					t && !t.destroyed && (t.autoplay.paused = !1, t.autoplay.running ? t.autoplay.run() : t.autoplay.stop())
				}) : (t.autoplay.paused = !1, t.autoplay.run())))
			}
		},
		te = {
			setTranslate: function () {
				for (var e = this.slides, t = 0; t < e.length; t += 1) {
					var i = this.slides.eq(t),
						s = -i[0].swiperSlideOffset;
					this.params.virtualTranslate || (s -= this.translate);
					var a = 0;
					this.isHorizontal() || (a = s, s = 0);
					var r = this.params.fadeEffect.crossFade ? Math.max(1 - Math.abs(i[0].progress), 0) : 1 + Math.min(Math.max(i[0].progress, -1), 0);
					i.css({
						opacity: r
					}).transform("translate3d(" + s + "px, " + a + "px, 0px)")
				}
			},
			setTransition: function (e) {
				var t = this,
					i = t.slides,
					s = t.$wrapperEl;
				if (i.transition(e), t.params.virtualTranslate && 0 !== e) {
					var a = !1;
					i.transitionEnd(function () {
						if (!a && t && !t.destroyed) {
							a = !0, t.animating = !1;
							for (var e = ["webkitTransitionEnd", "transitionend"], i = 0; i < e.length; i += 1) s.trigger(e[i])
						}
					})
				}
			}
		},
		ie = {
			setTranslate: function () {
				var e, t = this.$el,
					i = this.$wrapperEl,
					a = this.slides,
					r = this.width,
					n = this.height,
					o = this.rtl,
					l = this.size,
					d = this.params.cubeEffect,
					h = this.isHorizontal(),
					p = this.virtual && this.params.virtual.enabled,
					c = 0;
				d.shadow && (h ? (0 === (e = i.find(".swiper-cube-shadow")).length && (e = s('<div class="swiper-cube-shadow"></div>'), i.append(e)), e.css({
					height: r + "px"
				})) : 0 === (e = t.find(".swiper-cube-shadow")).length && (e = s('<div class="swiper-cube-shadow"></div>'), t.append(e)));
				for (var u = 0; u < a.length; u += 1) {
					var v = a.eq(u),
						f = u;
					p && (f = parseInt(v.attr("data-swiper-slide-index"), 10));
					var m = 90 * f,
						g = Math.floor(m / 360);
					o && (m = -m, g = Math.floor(-m / 360));
					var b = Math.max(Math.min(v[0].progress, 1), -1),
						w = 0,
						y = 0,
						x = 0;
					f % 4 == 0 ? (w = 4 * -g * l, x = 0) : (f - 1) % 4 == 0 ? (w = 0, x = 4 * -g * l) : (f - 2) % 4 == 0 ? (w = l + 4 * g * l, x = l) : (f - 3) % 4 == 0 && (w = -l, x = 3 * l + 4 * l * g), o && (w = -w), h || (y = w, w = 0);
					var E = "rotateX(" + (h ? 0 : -m) + "deg) rotateY(" + (h ? m : 0) + "deg) translate3d(" + w + "px, " + y + "px, " + x + "px)";
					if (b <= 1 && b > -1 && (c = 90 * f + 90 * b, o && (c = 90 * -f - 90 * b)), v.transform(E), d.slideShadows) {
						var T = h ? v.find(".swiper-slide-shadow-left") : v.find(".swiper-slide-shadow-top"),
							S = h ? v.find(".swiper-slide-shadow-right") : v.find(".swiper-slide-shadow-bottom");
						0 === T.length && (T = s('<div class="swiper-slide-shadow-' + (h ? "left" : "top") + '"></div>'), v.append(T)), 0 === S.length && (S = s('<div class="swiper-slide-shadow-' + (h ? "right" : "bottom") + '"></div>'), v.append(S)), T.length && (T[0].style.opacity = Math.max(-b, 0)), S.length && (S[0].style.opacity = Math.max(b, 0))
					}
				}
				if (i.css({
						"-webkit-transform-origin": "50% 50% -" + l / 2 + "px",
						"-moz-transform-origin": "50% 50% -" + l / 2 + "px",
						"-ms-transform-origin": "50% 50% -" + l / 2 + "px",
						"transform-origin": "50% 50% -" + l / 2 + "px"
					}), d.shadow)
					if (h) e.transform("translate3d(0px, " + (r / 2 + d.shadowOffset) + "px, " + -r / 2 + "px) rotateX(90deg) rotateZ(0deg) scale(" + d.shadowScale + ")");
					else {
						var C = Math.abs(c) - 90 * Math.floor(Math.abs(c) / 90),
							M = 1.5 - (Math.sin(2 * C * Math.PI / 360) / 2 + Math.cos(2 * C * Math.PI / 360) / 2),
							z = d.shadowScale,
							k = d.shadowScale / M,
							$ = d.shadowOffset;
						e.transform("scale3d(" + z + ", 1, " + k + ") translate3d(0px, " + (n / 2 + $) + "px, " + -n / 2 / k + "px) rotateX(-90deg)")
					}
				var L = P.isSafari || P.isUiWebView ? -l / 2 : 0;
				i.transform("translate3d(0px,0," + L + "px) rotateX(" + (this.isHorizontal() ? 0 : c) + "deg) rotateY(" + (this.isHorizontal() ? -c : 0) + "deg)")
			},
			setTransition: function (e) {
				var t = this.$el;
				this.slides.transition(e).find(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").transition(e), this.params.cubeEffect.shadow && !this.isHorizontal() && t.find(".swiper-cube-shadow").transition(e)
			}
		},
		se = {
			setTranslate: function () {
				for (var e = this.slides, t = 0; t < e.length; t += 1) {
					var i = e.eq(t),
						a = i[0].progress;
					this.params.flipEffect.limitRotation && (a = Math.max(Math.min(i[0].progress, 1), -1));
					var r = -180 * a,
						n = 0,
						o = -i[0].swiperSlideOffset,
						l = 0;
					if (this.isHorizontal() ? this.rtl && (r = -r) : (l = o, o = 0, n = -r, r = 0), i[0].style.zIndex = -Math.abs(Math.round(a)) + e.length, this.params.flipEffect.slideShadows) {
						var d = this.isHorizontal() ? i.find(".swiper-slide-shadow-left") : i.find(".swiper-slide-shadow-top"),
							h = this.isHorizontal() ? i.find(".swiper-slide-shadow-right") : i.find(".swiper-slide-shadow-bottom");
						0 === d.length && (d = s('<div class="swiper-slide-shadow-' + (this.isHorizontal() ? "left" : "top") + '"></div>'), i.append(d)), 0 === h.length && (h = s('<div class="swiper-slide-shadow-' + (this.isHorizontal() ? "right" : "bottom") + '"></div>'), i.append(h)), d.length && (d[0].style.opacity = Math.max(-a, 0)), h.length && (h[0].style.opacity = Math.max(a, 0))
					}
					i.transform("translate3d(" + o + "px, " + l + "px, 0px) rotateX(" + n + "deg) rotateY(" + r + "deg)")
				}
			},
			setTransition: function (e) {
				var t = this,
					i = t.slides,
					s = t.activeIndex,
					a = t.$wrapperEl;
				if (i.transition(e).find(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").transition(e), t.params.virtualTranslate && 0 !== e) {
					var r = !1;
					i.eq(s).transitionEnd(function () {
						if (!r && t && !t.destroyed) {
							r = !0, t.animating = !1;
							for (var e = ["webkitTransitionEnd", "transitionend"], i = 0; i < e.length; i += 1) a.trigger(e[i])
						}
					})
				}
			}
		},
		ae = {
			setTranslate: function () {
				for (var e = this.width, t = this.height, i = this.slides, a = this.$wrapperEl, r = this.slidesSizesGrid, n = this.params.coverflowEffect, o = this.isHorizontal(), l = this.translate, d = o ? e / 2 - l : t / 2 - l, p = o ? n.rotate : -n.rotate, c = n.depth, u = 0, v = i.length; u < v; u += 1) {
					var f = i.eq(u),
						m = r[u],
						g = (d - f[0].swiperSlideOffset - m / 2) / m * n.modifier,
						b = o ? p * g : 0,
						w = o ? 0 : p * g,
						y = -c * Math.abs(g),
						x = o ? 0 : n.stretch * g,
						E = o ? n.stretch * g : 0;
					Math.abs(E) < .001 && (E = 0), Math.abs(x) < .001 && (x = 0), Math.abs(y) < .001 && (y = 0), Math.abs(b) < .001 && (b = 0), Math.abs(w) < .001 && (w = 0);
					var T = "translate3d(" + E + "px," + x + "px," + y + "px)  rotateX(" + w + "deg) rotateY(" + b + "deg)";
					if (f.transform(T), f[0].style.zIndex = 1 - Math.abs(Math.round(g)), n.slideShadows) {
						var S = o ? f.find(".swiper-slide-shadow-left") : f.find(".swiper-slide-shadow-top"),
							C = o ? f.find(".swiper-slide-shadow-right") : f.find(".swiper-slide-shadow-bottom");
						0 === S.length && (S = s('<div class="swiper-slide-shadow-' + (o ? "left" : "top") + '"></div>'), f.append(S)), 0 === C.length && (C = s('<div class="swiper-slide-shadow-' + (o ? "right" : "bottom") + '"></div>'), f.append(C)), S.length && (S[0].style.opacity = g > 0 ? g : 0), C.length && (C[0].style.opacity = -g > 0 ? -g : 0)
					}
				}(h.pointerEvents || h.prefixedPointerEvents) && (a[0].style.perspectiveOrigin = d + "px 50%")
			},
			setTransition: function (e) {
				this.slides.transition(e).find(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").transition(e)
			}
		},
		re = [D, O, A, H, X, B, V, {
			name: "mousewheel",
			params: {
				mousewheel: {
					enabled: !1,
					releaseOnEdges: !1,
					invert: !1,
					forceToAxis: !1,
					sensitivity: 1,
					eventsTarged: "container"
				}
			},
			create: function () {
				d.extend(this, {
					mousewheel: {
						enabled: !1,
						enable: R.enable.bind(this),
						disable: R.disable.bind(this),
						handle: R.handle.bind(this),
						lastScrollTime: d.now()
					}
				})
			},
			on: {
				init: function () {
					this.params.mousewheel.enabled && this.mousewheel.enable()
				},
				destroy: function () {
					this.mousewheel.enabled && this.mousewheel.disable()
				}
			}
		}, {
			name: "navigation",
			params: {
				navigation: {
					nextEl: null,
					prevEl: null,
					hideOnClick: !1,
					disabledClass: "swiper-button-disabled",
					hiddenClass: "swiper-button-hidden",
					lockClass: "swiper-button-lock"
				}
			},
			create: function () {
				d.extend(this, {
					navigation: {
						init: F.init.bind(this),
						update: F.update.bind(this),
						destroy: F.destroy.bind(this)
					}
				})
			},
			on: {
				init: function () {
					this.navigation.init(), this.navigation.update()
				},
				toEdge: function () {
					this.navigation.update()
				},
				fromEdge: function () {
					this.navigation.update()
				},
				destroy: function () {
					this.navigation.destroy()
				},
				click: function (e) {
					var t = this.navigation,
						i = t.$nextEl,
						a = t.$prevEl;
					!this.params.navigation.hideOnClick || s(e.target).is(a) || s(e.target).is(i) || (i && i.toggleClass(this.params.navigation.hiddenClass), a && a.toggleClass(this.params.navigation.hiddenClass))
				}
			}
		}, {
			name: "pagination",
			params: {
				pagination: {
					el: null,
					bulletElement: "span",
					clickable: !1,
					hideOnClick: !1,
					renderBullet: null,
					renderProgressbar: null,
					renderFraction: null,
					renderCustom: null,
					type: "bullets",
					dynamicBullets: !1,
					dynamicMainBullets: 1,
					bulletClass: "swiper-pagination-bullet",
					bulletActiveClass: "swiper-pagination-bullet-active",
					modifierClass: "swiper-pagination-",
					currentClass: "swiper-pagination-current",
					totalClass: "swiper-pagination-total",
					hiddenClass: "swiper-pagination-hidden",
					progressbarFillClass: "swiper-pagination-progressbar-fill",
					clickableClass: "swiper-pagination-clickable",
					lockClass: "swiper-pagination-lock"
				}
			},
			create: function () {
				d.extend(this, {
					pagination: {
						init: W.init.bind(this),
						render: W.render.bind(this),
						update: W.update.bind(this),
						destroy: W.destroy.bind(this),
						dynamicBulletIndex: 0
					}
				})
			},
			on: {
				init: function () {
					this.pagination.init(), this.pagination.render(), this.pagination.update()
				},
				activeIndexChange: function () {
					this.params.loop ? this.pagination.update() : void 0 === this.snapIndex && this.pagination.update()
				},
				snapIndexChange: function () {
					this.params.loop || this.pagination.update()
				},
				slidesLengthChange: function () {
					this.params.loop && (this.pagination.render(), this.pagination.update())
				},
				snapGridLengthChange: function () {
					this.params.loop || (this.pagination.render(), this.pagination.update())
				},
				destroy: function () {
					this.pagination.destroy()
				},
				click: function (e) {
					this.params.pagination.el && this.params.pagination.hideOnClick && this.pagination.$el.length > 0 && !s(e.target).hasClass(this.params.pagination.bulletClass) && this.pagination.$el.toggleClass(this.params.pagination.hiddenClass)
				}
			}
		}, {
			name: "scrollbar",
			params: {
				scrollbar: {
					el: null,
					dragSize: "auto",
					hide: !1,
					draggable: !1,
					snapOnRelease: !0,
					lockClass: "swiper-scrollbar-lock",
					dragClass: "swiper-scrollbar-drag"
				}
			},
			create: function () {
				d.extend(this, {
					scrollbar: {
						init: q.init.bind(this),
						destroy: q.destroy.bind(this),
						updateSize: q.updateSize.bind(this),
						setTranslate: q.setTranslate.bind(this),
						setTransition: q.setTransition.bind(this),
						enableDraggable: q.enableDraggable.bind(this),
						disableDraggable: q.disableDraggable.bind(this),
						setDragPosition: q.setDragPosition.bind(this),
						onDragStart: q.onDragStart.bind(this),
						onDragMove: q.onDragMove.bind(this),
						onDragEnd: q.onDragEnd.bind(this),
						isTouched: !1,
						timeout: null,
						dragTimeout: null
					}
				})
			},
			on: {
				init: function () {
					this.scrollbar.init(), this.scrollbar.updateSize(), this.scrollbar.setTranslate()
				},
				update: function () {
					this.scrollbar.updateSize()
				},
				resize: function () {
					this.scrollbar.updateSize()
				},
				observerUpdate: function () {
					this.scrollbar.updateSize()
				},
				setTranslate: function () {
					this.scrollbar.setTranslate()
				},
				setTransition: function (e) {
					this.scrollbar.setTransition(e)
				},
				destroy: function () {
					this.scrollbar.destroy()
				}
			}
		}, {
			name: "parallax",
			params: {
				parallax: {
					enabled: !1
				}
			},
			create: function () {
				d.extend(this, {
					parallax: {
						setTransform: j.setTransform.bind(this),
						setTranslate: j.setTranslate.bind(this),
						setTransition: j.setTransition.bind(this)
					}
				})
			},
			on: {
				beforeInit: function () {
					this.params.parallax.enabled && (this.params.watchSlidesProgress = !0)
				},
				init: function () {
					this.params.parallax && this.parallax.setTranslate()
				},
				setTranslate: function () {
					this.params.parallax && this.parallax.setTranslate()
				},
				setTransition: function (e) {
					this.params.parallax && this.parallax.setTransition(e)
				}
			}
		}, {
			name: "zoom",
			params: {
				zoom: {
					enabled: !1,
					maxRatio: 3,
					minRatio: 1,
					toggle: !0,
					containerClass: "swiper-zoom-container",
					zoomedSlideClass: "swiper-slide-zoomed"
				}
			},
			create: function () {
				var e = this,
					t = {
						enabled: !1,
						scale: 1,
						currentScale: 1,
						isScaling: !1,
						gesture: {
							$slideEl: void 0,
							slideWidth: void 0,
							slideHeight: void 0,
							$imageEl: void 0,
							$imageWrapEl: void 0,
							maxRatio: 3
						},
						image: {
							isTouched: void 0,
							isMoved: void 0,
							currentX: void 0,
							currentY: void 0,
							minX: void 0,
							minY: void 0,
							maxX: void 0,
							maxY: void 0,
							width: void 0,
							height: void 0,
							startX: void 0,
							startY: void 0,
							touchesStart: {},
							touchesCurrent: {}
						},
						velocity: {
							x: void 0,
							y: void 0,
							prevPositionX: void 0,
							prevPositionY: void 0,
							prevTime: void 0
						}
					};
				"onGestureStart onGestureChange onGestureEnd onTouchStart onTouchMove onTouchEnd onTransitionEnd toggle enable disable in out".split(" ").forEach(function (i) {
					t[i] = K[i].bind(e)
				}), d.extend(e, {
					zoom: t
				})
			},
			on: {
				init: function () {
					this.params.zoom.enabled && this.zoom.enable()
				},
				destroy: function () {
					this.zoom.disable()
				},
				touchStart: function (e) {
					this.zoom.enabled && this.zoom.onTouchStart(e)
				},
				touchEnd: function (e) {
					this.zoom.enabled && this.zoom.onTouchEnd(e)
				},
				doubleTap: function (e) {
					this.params.zoom.enabled && this.zoom.enabled && this.params.zoom.toggle && this.zoom.toggle(e)
				},
				transitionEnd: function () {
					this.zoom.enabled && this.params.zoom.enabled && this.zoom.onTransitionEnd()
				}
			}
		}, {
			name: "lazy",
			params: {
				lazy: {
					enabled: !1,
					loadPrevNext: !1,
					loadPrevNextAmount: 1,
					loadOnTransitionStart: !1,
					elementClass: "swiper-lazy",
					loadingClass: "swiper-lazy-loading",
					loadedClass: "swiper-lazy-loaded",
					preloaderClass: "swiper-lazy-preloader"
				}
			},
			create: function () {
				d.extend(this, {
					lazy: {
						initialImageLoaded: !1,
						load: U.load.bind(this),
						loadInSlide: U.loadInSlide.bind(this)
					}
				})
			},
			on: {
				beforeInit: function () {
					this.params.lazy.enabled && this.params.preloadImages && (this.params.preloadImages = !1)
				},
				init: function () {
					this.params.lazy.enabled && !this.params.loop && 0 === this.params.initialSlide && this.lazy.load()
				},
				scroll: function () {
					this.params.freeMode && !this.params.freeModeSticky && this.lazy.load()
				},
				resize: function () {
					this.params.lazy.enabled && this.lazy.load()
				},
				scrollbarDragMove: function () {
					this.params.lazy.enabled && this.lazy.load()
				},
				transitionStart: function () {
					this.params.lazy.enabled && (this.params.lazy.loadOnTransitionStart || !this.params.lazy.loadOnTransitionStart && !this.lazy.initialImageLoaded) && this.lazy.load()
				},
				transitionEnd: function () {
					this.params.lazy.enabled && !this.params.lazy.loadOnTransitionStart && this.lazy.load()
				}
			}
		}, {
			name: "controller",
			params: {
				controller: {
					control: void 0,
					inverse: !1,
					by: "slide"
				}
			},
			create: function () {
				d.extend(this, {
					controller: {
						control: this.params.controller.control,
						getInterpolateFunction: _.getInterpolateFunction.bind(this),
						setTranslate: _.setTranslate.bind(this),
						setTransition: _.setTransition.bind(this)
					}
				})
			},
			on: {
				update: function () {
					this.controller.control && this.controller.spline && (this.controller.spline = void 0, delete this.controller.spline)
				},
				resize: function () {
					this.controller.control && this.controller.spline && (this.controller.spline = void 0, delete this.controller.spline)
				},
				observerUpdate: function () {
					this.controller.control && this.controller.spline && (this.controller.spline = void 0, delete this.controller.spline)
				},
				setTranslate: function (e, t) {
					this.controller.control && this.controller.setTranslate(e, t)
				},
				setTransition: function (e, t) {
					this.controller.control && this.controller.setTransition(e, t)
				}
			}
		}, {
			name: "a11y",
			params: {
				a11y: {
					enabled: !1,
					notificationClass: "swiper-notification",
					prevSlideMessage: "Previous slide",
					nextSlideMessage: "Next slide",
					firstSlideMessage: "This is the first slide",
					lastSlideMessage: "This is the last slide",
					paginationBulletMessage: "Go to slide {{index}}"
				}
			},
			create: function () {
				var e = this;
				d.extend(e, {
					a11y: {
						liveRegion: s('<span class="' + e.params.a11y.notificationClass + '" aria-live="assertive" aria-atomic="true"></span>')
					}
				}), Object.keys(Z).forEach(function (t) {
					e.a11y[t] = Z[t].bind(e)
				})
			},
			on: {
				init: function () {
					this.params.a11y.enabled && (this.a11y.init(), this.a11y.updateNavigation())
				},
				toEdge: function () {
					this.params.a11y.enabled && this.a11y.updateNavigation()
				},
				fromEdge: function () {
					this.params.a11y.enabled && this.a11y.updateNavigation()
				},
				paginationUpdate: function () {
					this.params.a11y.enabled && this.a11y.updatePagination()
				},
				destroy: function () {
					this.params.a11y.enabled && this.a11y.destroy()
				}
			}
		}, {
			name: "history",
			params: {
				history: {
					enabled: !1,
					replaceState: !1,
					key: "slides"
				}
			},
			create: function () {
				d.extend(this, {
					history: {
						init: Q.init.bind(this),
						setHistory: Q.setHistory.bind(this),
						setHistoryPopState: Q.setHistoryPopState.bind(this),
						scrollToSlide: Q.scrollToSlide.bind(this),
						destroy: Q.destroy.bind(this)
					}
				})
			},
			on: {
				init: function () {
					this.params.history.enabled && this.history.init()
				},
				destroy: function () {
					this.params.history.enabled && this.history.destroy()
				},
				transitionEnd: function () {
					this.history.initialized && this.history.setHistory(this.params.history.key, this.activeIndex)
				}
			}
		}, {
			name: "hash-navigation",
			params: {
				hashNavigation: {
					enabled: !1,
					replaceState: !1,
					watchState: !1
				}
			},
			create: function () {
				d.extend(this, {
					hashNavigation: {
						initialized: !1,
						init: J.init.bind(this),
						destroy: J.destroy.bind(this),
						setHash: J.setHash.bind(this),
						onHashCange: J.onHashCange.bind(this)
					}
				})
			},
			on: {
				init: function () {
					this.params.hashNavigation.enabled && this.hashNavigation.init()
				},
				destroy: function () {
					this.params.hashNavigation.enabled && this.hashNavigation.destroy()
				},
				transitionEnd: function () {
					this.hashNavigation.initialized && this.hashNavigation.setHash()
				}
			}
		}, {
			name: "autoplay",
			params: {
				autoplay: {
					enabled: !1,
					delay: 3e3,
					waitForTransition: !0,
					disableOnInteraction: !0,
					stopOnLastSlide: !1,
					reverseDirection: !1
				}
			},
			create: function () {
				d.extend(this, {
					autoplay: {
						running: !1,
						paused: !1,
						run: ee.run.bind(this),
						start: ee.start.bind(this),
						stop: ee.stop.bind(this),
						pause: ee.pause.bind(this)
					}
				})
			},
			on: {
				init: function () {
					this.params.autoplay.enabled && this.autoplay.start()
				},
				beforeTransitionStart: function (e, t) {
					this.autoplay.running && (t || !this.params.autoplay.disableOnInteraction ? this.autoplay.pause(e) : this.autoplay.stop())
				},
				sliderFirstMove: function () {
					this.autoplay.running && (this.params.autoplay.disableOnInteraction ? this.autoplay.stop() : this.autoplay.pause())
				},
				destroy: function () {
					this.autoplay.running && this.autoplay.stop()
				}
			}
		}, {
			name: "effect-fade",
			params: {
				fadeEffect: {
					crossFade: !1
				}
			},
			create: function () {
				d.extend(this, {
					fadeEffect: {
						setTranslate: te.setTranslate.bind(this),
						setTransition: te.setTransition.bind(this)
					}
				})
			},
			on: {
				beforeInit: function () {
					if ("fade" === this.params.effect) {
						this.classNames.push(this.params.containerModifierClass + "fade");
						var e = {
							slidesPerView: 1,
							slidesPerColumn: 1,
							slidesPerGroup: 1,
							watchSlidesProgress: !0,
							spaceBetween: 0,
							virtualTranslate: !0
						};
						d.extend(this.params, e), d.extend(this.originalParams, e)
					}
				},
				setTranslate: function () {
					"fade" === this.params.effect && this.fadeEffect.setTranslate()
				},
				setTransition: function (e) {
					"fade" === this.params.effect && this.fadeEffect.setTransition(e)
				}
			}
		}, {
			name: "effect-cube",
			params: {
				cubeEffect: {
					slideShadows: !0,
					shadow: !0,
					shadowOffset: 20,
					shadowScale: .94
				}
			},
			create: function () {
				d.extend(this, {
					cubeEffect: {
						setTranslate: ie.setTranslate.bind(this),
						setTransition: ie.setTransition.bind(this)
					}
				})
			},
			on: {
				beforeInit: function () {
					if ("cube" === this.params.effect) {
						this.classNames.push(this.params.containerModifierClass + "cube"), this.classNames.push(this.params.containerModifierClass + "3d");
						var e = {
							slidesPerView: 1,
							slidesPerColumn: 1,
							slidesPerGroup: 1,
							watchSlidesProgress: !0,
							resistanceRatio: 0,
							spaceBetween: 0,
							centeredSlides: !1,
							virtualTranslate: !0
						};
						d.extend(this.params, e), d.extend(this.originalParams, e)
					}
				},
				setTranslate: function () {
					"cube" === this.params.effect && this.cubeEffect.setTranslate()
				},
				setTransition: function (e) {
					"cube" === this.params.effect && this.cubeEffect.setTransition(e)
				}
			}
		}, {
			name: "effect-flip",
			params: {
				flipEffect: {
					slideShadows: !0,
					limitRotation: !0
				}
			},
			create: function () {
				d.extend(this, {
					flipEffect: {
						setTranslate: se.setTranslate.bind(this),
						setTransition: se.setTransition.bind(this)
					}
				})
			},
			on: {
				beforeInit: function () {
					if ("flip" === this.params.effect) {
						this.classNames.push(this.params.containerModifierClass + "flip"), this.classNames.push(this.params.containerModifierClass + "3d");
						var e = {
							slidesPerView: 1,
							slidesPerColumn: 1,
							slidesPerGroup: 1,
							watchSlidesProgress: !0,
							spaceBetween: 0,
							virtualTranslate: !0
						};
						d.extend(this.params, e), d.extend(this.originalParams, e)
					}
				},
				setTranslate: function () {
					"flip" === this.params.effect && this.flipEffect.setTranslate()
				},
				setTransition: function (e) {
					"flip" === this.params.effect && this.flipEffect.setTransition(e)
				}
			}
		}, {
			name: "effect-coverflow",
			params: {
				coverflowEffect: {
					rotate: 50,
					stretch: 0,
					depth: 100,
					modifier: 1,
					slideShadows: !0
				}
			},
			create: function () {
				d.extend(this, {
					coverflowEffect: {
						setTranslate: ae.setTranslate.bind(this),
						setTransition: ae.setTransition.bind(this)
					}
				})
			},
			on: {
				beforeInit: function () {
					"coverflow" === this.params.effect && (this.classNames.push(this.params.containerModifierClass + "coverflow"), this.classNames.push(this.params.containerModifierClass + "3d"), this.params.watchSlidesProgress = !0, this.originalParams.watchSlidesProgress = !0)
				},
				setTranslate: function () {
					"coverflow" === this.params.effect && this.coverflowEffect.setTranslate()
				},
				setTransition: function (e) {
					"coverflow" === this.params.effect && this.coverflowEffect.setTransition(e)
				}
			}
		}];
	return void 0 === I.use && (I.use = I.Class.use, I.installModule = I.Class.installModule), I.use(re), I
});;
! function (e, t) {
	if ("function" == typeof define && define.amd) define("GLightbox", ["module"], t);
	else if ("undefined" != typeof exports) t(module);
	else {
		var i = {
			exports: {}
		};
		t(i), e.GLightbox = i.exports
	}
}(this, function (e) {
	"use strict";

	function t() {
		var e = {},
			i = !1,
			n = 0,
			s = arguments.length;
		"[object Boolean]" === Object.prototype.toString.call(arguments[0]) && (i = arguments[0], n++);
		for (var o = function (n) {
				for (var s in n) Object.prototype.hasOwnProperty.call(n, s) && (i && "[object Object]" === Object.prototype.toString.call(n[s]) ? e[s] = t(!0, e[s], n[s]) : e[s] = n[s])
			}; n < s; n++) {
			o(arguments[n])
		}
		return e
	}

	function i(e, t) {
		if ((j.isNode(e) || e === window || e === document) && (e = [e]), j.isArrayLike(e) || j.isObject(e) || (e = [e]), 0 != j.size(e))
			if (j.isArrayLike(e) && !j.isObject(e))
				for (var i = e.length, n = 0; n < i && !1 !== t.call(e[n], e[n], n, e); n++);
			else if (j.isObject(e))
			for (var s in e)
				if (j.has(e, s) && !1 === t.call(e[s], e[s], s, e)) break
	}

	function n(e) {
		function t(e) {
			j.isFunction(o) && o.call(c, e, this), r && t.destroy()
		}
		var n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
			s = n.onElement,
			o = n.withCallback,
			l = n.once,
			r = void 0 !== l && l,
			a = n.useCapture,
			d = void 0 !== a && a,
			c = arguments[2],
			u = s || [];
		return j.isString(u) && (u = document.querySelectorAll(u)), t.destroy = function () {
			i(u, function (i) {
				i.removeEventListener(e, t, d)
			})
		}, i(u, function (i) {
			i.addEventListener(e, t, d)
		}), t
	}

	function s(e, t) {
		l(e, t) || (e.classList ? e.classList.add(t) : e.className += " " + t)
	}

	function o(e, t) {
		var n = t.split(" ");
		n.length > 1 ? i(n, function (t) {
			o(e, t)
		}) : e.classList ? e.classList.remove(t) : e.className = e.className.replace(t, "")
	}

	function l(e, t) {
		return e.classList ? e.classList.contains(t) : new RegExp("(^| )" + t + "( |$)", "gi").test(e.className)
	}

	function r(e) {
		var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "",
			l = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
		if ("" === t) return !1;
		var r = t.split(" ");
		i(r, function (t) {
			s(e, "g" + t)
		});
		n(T, {
			onElement: e,
			once: !0,
			withCallback: function (e, t) {
				i(r, function (e) {
					o(t, "g" + e)
				}), j.isFunction(l) && l()
			}
		})
	}

	function a(e) {
		var t = document.createDocumentFragment(),
			i = document.createElement("div");
		for (i.innerHTML = e; i.firstChild;) t.appendChild(i.firstChild);
		return t
	}

	function d(e, t) {
		for (; e !== document.body;)
			if ((e = e.parentElement).matches(t)) return e
	}

	function c(e) {
		e.style.display = "block"
	}

	function u(e) {
		e.style.display = "none"
	}

	function h(e, i, n) {
		var o = this,
			l = i.source,
			r = "gvideo" + i.index,
			d = e.querySelector(".gslide-media"),
			c = i.href,
			u = location.protocol.replace(":", "");
		if ("file" == u && (u = "http"), "vimeo" == l) {
			var h = /vimeo.*\/(\d+)/i.exec(c),
				g = p(this.settings.vimeo.params),
				m = v(u + "://player.vimeo.com/video/" + h[1] + "?" + g, this.settings.videosWidth, this.settings.videosHeight, n);
			m.id = r, m.className = "vimeo-video gvideo", this.settings.autoplayVideos && (m.className += " wait-autoplay"), f(this.settings.vimeo.api, function () {
				var e = new Vimeo.Player(m);
				O[r] = e, d.appendChild(m)
			})
		}
		if ("youtube" == l) {
			var y = p(t(this.settings.youtube.params, {
					playerapiid: r
				})),
				b = v(u + "://www.youtube.com/embed/" + function (e) {
					var t = "";
					t = void 0 !== (e = e.replace(/(>|<)/gi, "").split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/))[2] ? (t = e[2].split(/[^0-9a-z_\-]/i))[0] : e;
					return t
				}(c) + "?" + y, this.settings.videosWidth, this.settings.videosHeight, n);
			b.id = r, b.className = "youtube-video gvideo", this.settings.autoplayVideos && (b.className += " wait-autoplay"), f(this.settings.youtube.api, function () {
				if (!j.isNil(YT) && YT.loaded) {
					var e = new YT.Player(b);
					O[r] = e
				} else q.push(b);
				d.appendChild(b)
			})
		}
		if ("local" == l) {
			var S = '<video id="' + r + '" ';
			S += 'style="background:#000; width: ' + this.settings.width + "px; height: " + this.settings.height + 'px;" ', S += 'preload="metadata" ', S += 'x-webkit-airplay="allow" ', S += 'webkit-playsinline="" ', S += "controls ", S += 'class="gvideo">';
			var w = {
				mp4: "",
				ogg: "",
				webm: ""
			};
			w[c.toLowerCase().split(".").pop()] = c;
			for (var x in w)
				if (w.hasOwnProperty(x)) {
					var k = w[x];
					i.hasOwnProperty(x) && (k = i[x]), "" !== k && (S += '<source src="' + k + '" type="video/' + x + '">')
				}
			var E = a(S += "</video>");
			d.appendChild(E);
			var C = document.getElementById(r);
			if (null !== this.settings.jwplayer && null !== this.settings.jwplayer.api) {
				this.settings.jwplayer;
				var A = this.settings.jwplayer.api;
				if (!A) return console.warn("Missing jwplayer api file"), j.isFunction(n) && n(), !1;
				f(A, function () {
					var e = t(o.settings.jwplayer.params, {
						width: o.settings.width + "px",
						height: o.settings.height + "px",
						file: c
					});
					jwplayer.key = o.settings.jwplayer.licenseKey;
					var i = jwplayer(r);
					i.setup(e), O[r] = i, i.on("ready", function () {
						s(C = d.querySelector(".jw-video"), "gvideo"), C.id = r, j.isFunction(n) && n()
					})
				})
			} else s(C, "html5-video"), O[r] = C, j.isFunction(n) && n()
		}
	}

	function v(e, t, i, n) {
		var o = document.createElement("iframe"),
			l = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
		return o.className = "vimeo-video gvideo", o.src = e, o.style.height = x && l < 767 ? "" : i + "px", o.style.width = t + "px", o.setAttribute("allowFullScreen", ""), o.onload = function () {
			s(o, "iframe-ready"), j.isFunction(n) && n()
		}, o
	}

	function f(e, t) {
		if (j.isNil(e)) console.error("Inject videos api error");
		else {
			var i = document.querySelectorAll('script[src="' + e + '"]');
			if (j.isNil(i) || 0 == i.length) {
				var n = document.createElement("script");
				return n.type = "text/javascript", n.src = e, n.onload = function () {
					t()
				}, document.body.appendChild(n), !1
			}
			t()
		}
	}

	function g() {
		for (var e = 0; e < q.length; e++) {
			var t = q[e],
				i = new YT.Player(t);
			O[t.id] = i
		}
	}

	function p(e) {
		var t = "",
			n = 0;
		return i(e, function (e, i) {
			n > 0 && (t += "&amp;"), t += i + "=" + e, n += 1
		}), t
	}

	function m(e) {
		var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "";
		if ("" == t) return e.style.webkitTransform = "", e.style.MozTransform = "", e.style.msTransform = "", e.style.OTransform = "", e.style.transform = "", !1;
		e.style.webkitTransform = t, e.style.MozTransform = t, e.style.msTransform = t, e.style.OTransform = t, e.style.transform = t
	}

	function y(e) {
		var t = e.querySelector(".gslide-media"),
			i = e.querySelector(".gslide-description");
		s(t, "greset"), m(t, "translate3d(0, 0, 0)");
		n(A, {
			onElement: t,
			once: !0,
			withCallback: function (e, i) {
				o(t, "greset")
			}
		});
		t.style.opacity = "", i && (i.style.opacity = "")
	}

	function b(e, t) {
		var i = e.querySelector(".desc-more");
		if (!i) return !1;
		n("click", {
			onElement: i,
			withCallback: function (e, i) {
				e.preventDefault();
				var l = d(i, ".gslide-desc");
				if (!l) return !1;
				l.innerHTML = t.description, s(C, "gdesc-open");
				var r = n("click", {
					onElement: [C, d(l, ".gslide-description")],
					withCallback: function (e, i) {
						"a" !== e.target.nodeName.toLowerCase() && (o(C, "gdesc-open"), s(C, "gdesc-closed"), l.innerHTML = t.smallDescription, b(l, t), setTimeout(function () {
							o(C, "gdesc-closed")
						}, 400), r.destroy())
					}
				})
			}
		})
	}
	var S = function () {
			function e(e, t) {
				for (var i = 0; i < t.length; i++) {
					var n = t[i];
					n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, n.key, n)
				}
			}
			return function (t, i, n) {
				return i && e(t.prototype, i), n && e(t, n), t
			}
		}(),
		w = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (e) {
			return typeof e
		} : function (e) {
			return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
		},
		x = navigator.userAgent.match(/(iPad)|(iPhone)|(iPod)|(Android)|(PlayBook)|(BB10)|(BlackBerry)|(Opera Mini)|(IEMobile)|(webOS)|(MeeGo)/i),
		k = null !== x || void 0 !== document.createTouch || "ontouchstart" in window || "onmsgesturechange" in window || navigator.msMaxTouchPoints,
		E = document.getElementsByTagName("html")[0],
		C = document.body,
		A = function () {
			var e = void 0,
				t = document.createElement("fakeelement"),
				i = {
					transition: "transitionend",
					OTransition: "oTransitionEnd",
					MozTransition: "transitionend",
					WebkitTransition: "webkitTransitionEnd"
				};
			for (e in i)
				if (void 0 !== t.style[e]) return i[e]
		}(),
		T = function () {
			var e = void 0,
				t = document.createElement("fakeelement"),
				i = {
					animation: "animationend",
					OAnimation: "oAnimationEnd",
					MozAnimation: "animationend",
					WebkitAnimation: "webkitAnimationEnd"
				};
			for (e in i)
				if (void 0 !== t.style[e]) return i[e]
		}(),
		q = [],
		O = {},
		L = {
			selector: "glightbox",
			skin: "clean",
			closeButton: !0,
			startAt: 0,
			autoplayVideos: !0,
			descPosition: "bottom",
			width: 900,
			height: 506,
			videosWidth: 900,
			videosHeight: 506,
			beforeSlideChange: null,
			afterSlideChange: null,
			beforeSlideLoad: null,
			afterSlideLoad: null,
			onOpen: null,
			onClose: null,
			loopAtEnd: !1,
			jwplayer: {
				api: null,
				licenseKey: null,
				params: {
					width: "100%",
					aspectratio: "16:9",
					stretching: "uniform"
				}
			},
			vimeo: {
				api: "https://player.vimeo.com/api/player.js",
				params: {
					api: 1,
					title: 0,
					byline: 0,
					portrait: 0
				}
			},
			youtube: {
				api: "https://www.youtube.com/iframe_api",
				params: {
					enablejsapi: 1,
					showinfo: 0
				}
			},
			openEffect: "zoomIn",
			closeEffect: "zoomOut",
			slideEffect: "slide",
			moreText: "See more",
			moreLength: 60,
			slideHtml: "",
			lightboxHtml: "",
			cssEfects: {
				fade: {
					in: "fadeIn",
					out: "fadeOut"
				},
				zoom: {
					in: "zoomIn",
					out: "zoomOut"
				},
				slide: {
					in: "slideInRight",
					out: "slideOutLeft"
				},
				slide_back: {
					in: "slideInLeft",
					out: "slideOutRight"
				}
			}
		};
	L.slideHtml = '<div class="gslide">         <div class="gslide-inner-content">            <div class="ginner-container">               <div class="gslide-media">               </div>               <div class="gslide-description">                  <h4 class="gslide-title"></h4>                  <div class="gslide-desc"></div>               </div>            </div>         </div>       </div>';
	L.lightboxHtml = '<div id="glightbox-body" class="glightbox-container">            <div class="gloader visible"></div>            <div class="goverlay"></div>            <div class="gcontainer">               <div id="glightbox-slider" class="gslider"></div>               <a class="gnext"></a>               <a class="gprev"></a>               <a class="gclose"></a>            </div>   </div>';
	var j = {
			isFunction: function (e) {
				return "function" == typeof e
			},
			isString: function (e) {
				return "string" == typeof e
			},
			isNode: function (e) {
				return !(!e || !e.nodeType || 1 != e.nodeType)
			},
			isArray: function (e) {
				return Array.isArray(e)
			},
			isArrayLike: function (e) {
				return e && e.length && isFinite(e.length)
			},
			isObject: function (e) {
				return "object" === (void 0 === e ? "undefined" : w(e)) && null != e && !j.isFunction(e) && !j.isArray(e)
			},
			isNil: function (e) {
				return null == e
			},
			has: function (e, t) {
				return null !== e && hasOwnProperty.call(e, t)
			},
			size: function (e) {
				if (j.isObject(e)) {
					if (e.keys) return e.keys().length;
					var t = 0;
					for (var i in e) j.has(e, i) && t++;
					return t
				}
				return e.length
			},
			isNumber: function (e) {
				return !isNaN(parseFloat(e)) && isFinite(e)
			}
		},
		N = function () {
			var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
			if (null === e) return !1;
			var n = "",
				s = e.getAttribute("data-glightbox"),
				o = e.nodeName.toLowerCase();
			"a" === o && (n = e.href), "img" === o && (n = e.src);
			var l = {
					href: n,
					title: "",
					description: "",
					descPosition: "bottom",
					effect: ""
				},
				r = B(n);
			if (l = t(l, r), j.isNil(s)) {
				if ("a" == o) {
					var a = e.title;
					j.isNil(a) || "" === a || (l.title = a)
				}
				if ("img" == o) {
					var d = e.alt;
					j.isNil(d) || "" === d || (l.title = d)
				}
				var c = e.getAttribute("data-description");
				j.isNil(c) || "" === c || (l.description = c)
			} else "" !== (s = s.replace(/'/g, '\\"')).trim() && (s = (s = s.split(";")).filter(Boolean)), i(s, function (e) {
				if (e = e.trim().split(":"), 2 == j.size(e)) {
					var t = e[0].trim(),
						i = e[1].trim();
					"" !== i && (i = i.replace(/\\/g, "")), l[t] = i
				}
			});
			var u = e.querySelector(".glightbox-desc");
			return u && (l.description = u.innerHTML), l
		},
		I = function () {
			var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null,
				t = this,
				i = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
				n = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
			if (l(e, "loaded")) return !1;
			j.isFunction(this.settings.beforeSlideLoad) && this.settings.beforeSlideLoad(e, i);
			var o = i.sourcetype,
				r = i.descPosition,
				a = e.querySelector(".gslide-media"),
				d = e.querySelector(".gslide-title"),
				c = e.querySelector(".gslide-desc"),
				u = e.querySelector(".gslide-description"),
				f = n;
			if (n && j.isFunction(this.settings.afterSlideLoad) && (f = function () {
					n(), t.settings.afterSlideLoad(e, i)
				}), "" == i.title && "" == i.description ? u && u.parentNode.removeChild(u) : (d && "" !== i.title ? d.innerHTML = i.title : d.parentNode.removeChild(d), c && "" !== i.description ? x && this.settings.moreLength > 0 ? (i.smallDescription = function (e) {
					var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 50,
						i = arguments.length > 2 && void 0 !== arguments[2] && arguments[2],
						n = i;
					if ((e = e.trim()).length <= t) return e;
					var s = e.substr(0, t - 1);
					return n ? s + '... <a href="#" class="desc-more">' + i + "</a>" : s
				}(i.description, this.settings.moreLength, this.settings.moreText), c.innerHTML = i.smallDescription, b.apply(this, [c, i])) : c.innerHTML = i.description : c.parentNode.removeChild(c), s(a.parentNode, "desc-" + r), s(u, "description-" + r)), s(a, "gslide-" + o), s(e, "loaded"), "video" !== o)
				if ("external" !== o)
					if ("inline" !== o) {
						if ("image" === o) {
							var g = new Image;
							return g.addEventListener("load", function () {
								j.isFunction(f) && f()
							}, !1), g.src = i.href, void a.appendChild(g)
						}
						j.isFunction(f) && f()
					} else(function (e, t, i) {
						var n = e.querySelector(".gslide-media"),
							o = document.getElementById(t.inlined.replace("#", ""));
						if (o) {
							var l = o.cloneNode(!0);
							return l.style.height = this.settings.height + "px", l.style.maxWidth = this.settings.width + "px", s(l, "ginlined-content"), n.appendChild(l), void(j.isFunction(i) && i())
						}
					}).apply(this, [e, i, f]);
			else {
				var p = v(i.href, this.settings.width, this.settings.height, f);
				a.appendChild(p)
			} else h.apply(this, [e, i, f])
		};
	void 0 !== window.onYouTubeIframeAPIReady ? window.onYouTubeIframeAPIReady = function () {
		window.onYouTubeIframeAPIReady(), g()
	} : window.onYouTubeIframeAPIReady = g;
	var B = function (e) {
			var t = e,
				i = {};
			if (null !== (e = e.toLowerCase()).match(/\.(jpeg|jpg|gif|png)$/)) return i.sourcetype = "image", i;
			if (e.match(/(youtube\.com|youtube-nocookie\.com)\/watch\?v=([a-zA-Z0-9\-_]+)/) || e.match(/youtu\.be\/([a-zA-Z0-9\-_]+)/)) return i.sourcetype = "video", i.source = "youtube", i;
			if (e.match(/vimeo\.com\/([0-9]*)/)) return i.sourcetype = "video", i.source = "vimeo", i;
			if (null !== e.match(/\.(mp4|ogg|webm)$/)) return i.sourcetype = "video", i.source = "local", i;
			if (e.indexOf("#") > -1) {
				var n = t.split("#").pop();
				if ("" !== n.trim()) return i.sourcetype = "inline", i.source = e, i.inlined = "#" + n, i
			}
			return e.includes("gajax=true") && (i.sourcetype = "ajax", i.source = e), i.sourcetype = "external", i.source = e, i
		},
		M = function () {
			function e(i) {
				! function (e, t) {
					if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function")
				}(this, e), this.settings = t(L, i || {}), this.effectsClasses = this.getAnimationClasses()
			}
			return S(e, [{
				key: "init",
				value: function () {
					var e = this;
					this.baseEvents = n("click", {
						onElement: "." + this.settings.selector,
						withCallback: function (t, i) {
							t.preventDefault(), e.open(i)
						}
					})
				}
			}, {
				key: "open",
				value: function () {
					var e = arguments.length > 0 && void 0 !== arguments[0] && arguments[0];
					if (this.elements = this.getElements(e), 0 == this.elements.length) return !1;
					this.activeSlide = null, this.prevActiveSlideIndex = null, this.prevActiveSlide = null;
					var t = this.settings.startAt;
					e && (t = this.elements.indexOf(e)) < 0 && (t = 0), this.build(), r(this.overlay, this.settings.cssEfects.fade.in);
					var i = C.offsetWidth;
					if (C.style.width = i + "px", s(C, "glightbox-open"), s(E, "glightbox-open"), x && (s(E, "glightbox-mobile"), this.settings.slideEffect = "slide"), this.showSlide(t, !0), 1 == this.elements.length ? (u(this.prevButton), u(this.nextButton)) : (c(this.prevButton), c(this.nextButton)), this.lightboxOpen = !0, j.isFunction(this.settings.onOpen) && this.settings.onOpen(), x && k) return function () {
						var e = this,
							t = void 0,
							i = void 0,
							r = void 0,
							a = void 0,
							d = void 0,
							c = void 0,
							u = !1,
							h = !1,
							v = !1,
							f = !1,
							g = {},
							p = {},
							b = (this.slidesContainer, null),
							S = 0,
							w = 0,
							x = null,
							k = null,
							E = null,
							A = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
						window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight, this.events.doctouchmove = n("touchmove", {
							onElement: document,
							withCallback: function (e, t) {
								if (l(C, "gdesc-open")) return e.preventDefault(), !1
							}
						}), this.events.touchStart = n("touchstart", {
							onElement: C,
							withCallback: function (i, n) {
								l(C, "gdesc-open") || (s(C, "touching"), b = e.getActiveSlide(), x = b.querySelector(".gslide-image"), k = b.querySelector(".gslide-media"), E = b.querySelector(".gslide-description"), t = e.index, p = i.targetTouches[0], g.pageX = i.targetTouches[0].pageX, g.pageY = i.targetTouches[0].pageY, S = i.targetTouches[0].clientX, w = i.targetTouches[0].clientY)
							}
						}), this.events.gestureStart = n("gesturestart", {
							onElement: C,
							withCallback: function (e, t) {
								x && (e.preventDefault(), v = !0)
							}
						}), this.events.gestureChange = n("gesturechange", {
							onElement: C,
							withCallback: function (e, t) {
								e.preventDefault(), m(x, "scale(" + e.scale + ")")
							}
						}), this.events.gesturEend = n("gestureend", {
							onElement: C,
							withCallback: function (e, t) {
								v = !1, e.scale < 1 ? (f = !1, m(x, "scale(1)")) : f = !0
							}
						}), this.events.touchMove = n("touchmove", {
							onElement: C,
							withCallback: function (t, n) {
								if (l(C, "touching") && !(l(C, "gdesc-open") || v || f)) {
									t.preventDefault(), p = t.targetTouches[0];
									var s = b.querySelector(".gslide-inner-content").offsetHeight,
										o = b.querySelector(".gslide-inner-content").offsetWidth,
										x = t.targetTouches[0].clientX,
										T = t.targetTouches[0].clientY,
										q = S - x,
										O = w - T;
									if (Math.abs(q) > Math.abs(O) ? (u = !1, h = !0) : (h = !1, u = !0), u) {
										if (d = r, r = p.pageY - g.pageY, Math.abs(r) >= 0 || u) {
											var L = .75 - Math.abs(r) / s;
											k.style.opacity = L, E && (E.style.opacity = L), m(k, "translate3d(0, " + r + "px, 0)")
										}
									} else if (a = i, i = p.pageX - g.pageX, c = 100 * i / A, h) {
										if (e.index + 1 == e.elements.length && i < -60) return y(b), !1;
										if (e.index - 1 < 0 && i > 60) return y(b), !1;
										var j = .75 - Math.abs(i) / o;
										k.style.opacity = j, E && (E.style.opacity = j), m(k, "translate3d(" + c + "%, 0, 0)")
									}
								}
							}
						}), this.events.touchEnd = n("touchend", {
							onElement: C,
							withCallback: function (t, n) {
								r = p.pageY - g.pageY, i = p.pageX - g.pageX, c = 100 * i / A, o(C, "touching");
								var s = b.querySelector(".gslide-inner-content").offsetHeight,
									l = b.querySelector(".gslide-inner-content").offsetWidth;
								if (u) {
									var a = s / 2;
									return u = !1, Math.abs(r) >= a ? void e.close() : void y(b)
								}
								if (h) {
									h = !1;
									var d = "prev",
										v = !0;
									if (i < 0 && (d = "next", i = Math.abs(i)), "prev" == d && e.index - 1 < 0 && (v = !1), "next" == d && e.index + 1 >= e.elements.length && (v = !1), v && i >= l / 2 - 90) return void("next" == d ? e.nextSlide() : e.prevSlide());
									y(b)
								}
							}
						})
					}.apply(this), !1;
					(function () {
						var e = this;
						this.events.keyboard = n("keydown", {
							onElement: window,
							withCallback: function (t, i) {
								var n = (t = t || window.event).keyCode;
								39 == n && e.nextSlide(), 37 == n && e.prevSlide(), 27 == n && e.close()
							}
						})
					}).apply(this)
				}
			}, {
				key: "showSlide",
				value: function () {
					var e = this,
						t = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 0,
						i = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
					c(this.loader), this.index = t;
					var n = this.slidesContainer.querySelector(".current");
					n && o(n, "current"), this.slideAnimateOut();
					var r = this.slidesContainer.querySelectorAll(".gslide")[t];
					if (c(this.slidesContainer), l(r, "loaded")) this.slideAnimateIn(r, i), u(this.loader);
					else {
						c(this.loader);
						var a = N(this.elements[t]);
						a.index = t, I.apply(this, [r, a, function () {
							u(e.loader), e.slideAnimateIn(r, i)
						}])
					}
					this.preloadSlide(t + 1), this.preloadSlide(t - 1), o(this.nextButton, "disabled"), o(this.prevButton, "disabled"), 0 === t ? s(this.prevButton, "disabled") : t === this.elements.length - 1 && !0 !== this.settings.loopAtEnd && s(this.nextButton, "disabled"), this.activeSlide = r
				}
			}, {
				key: "preloadSlide",
				value: function (e) {
					var t = this;
					if (e < 0 || e > this.elements.length) return !1;
					if (j.isNil(this.elements[e])) return !1;
					var i = this.slidesContainer.querySelectorAll(".gslide")[e];
					if (l(i, "loaded")) return !1;
					var n = N(this.elements[e]);
					n.index = e;
					var s = n.sourcetype;
					"video" == s || "external" == s ? setTimeout(function () {
						I.apply(t, [i, n])
					}, 200) : I.apply(this, [i, n])
				}
			}, {
				key: "prevSlide",
				value: function () {
					var e = this.index - 1;
					if (e < 0) return !1;
					this.goToSlide(e)
				}
			}, {
				key: "nextSlide",
				value: function () {
					var e = this.index + 1;
					if (e > this.elements.length) return !1;
					this.goToSlide(e)
				}
			}, {
				key: "goToSlide",
				value: function () {
					var e = arguments.length > 0 && void 0 !== arguments[0] && arguments[0];
					e > -1 && (this.prevActiveSlide = this.activeSlide, this.prevActiveSlideIndex = this.index, e < this.elements.length ? this.showSlide(e) : !0 === this.settings.loopAtEnd && (e = 0, this.showSlide(e)))
				}
			}, {
				key: "slideAnimateIn",
				value: function (e, t) {
					var i = this,
						n = e.querySelector(".gslide-media"),
						l = e.querySelector(".gslide-description"),
						a = {
							index: this.prevActiveSlideIndex,
							slide: this.prevActiveSlide
						},
						d = {
							index: this.index,
							slide: this.activeSlide
						};
					if (n.offsetWidth > 0 && l && (u(l), e.querySelector(".ginner-container").style.maxWidth = n.offsetWidth + "px", l.style.display = ""), o(e, this.effectsClasses), t) r(e, this.settings.openEffect, function () {
						!x && i.settings.autoplayVideos && i.playSlideVideo(e), j.isFunction(i.settings.afterSlideChange) && i.settings.afterSlideChange.apply(i, [a, d])
					});
					else {
						var c = this.settings.slideEffect,
							h = this.settings.cssEfects[c].in;
						this.prevActiveSlideIndex > this.index && "slide" == this.settings.slideEffect && (h = this.settings.cssEfects.slide_back.in), r(e, h, function () {
							!x && i.settings.autoplayVideos && i.playSlideVideo(e), j.isFunction(i.settings.afterSlideChange) && i.settings.afterSlideChange.apply(i, [a, d])
						})
					}
					s(e, "current")
				}
			}, {
				key: "slideAnimateOut",
				value: function () {
					if (!this.prevActiveSlide) return !1;
					var e = this.prevActiveSlide;
					o(e, this.effectsClasses), s(e, "prev");
					var t = this.settings.slideEffect,
						i = this.settings.cssEfects[t].out;
					this.stopSlideVideo(e), j.isFunction(this.settings.beforeSlideChange) && this.settings.beforeSlideChange.apply(this, [{
						index: this.prevActiveSlideIndex,
						slide: this.prevActiveSlide
					}, {
						index: this.index,
						slide: this.activeSlide
					}]), this.prevActiveSlideIndex > this.index && "slide" == this.settings.slideEffect && (i = this.settings.cssEfects.slide_back.out), r(e, i, function () {
						var t = e.querySelector(".gslide-media"),
							i = e.querySelector(".gslide-description");
						t.style.transform = "", o(t, "greset"), t.style.opacity = "", i && (i.style.opacity = ""), o(e, "prev")
					})
				}
			}, {
				key: "stopSlideVideo",
				value: function (e) {
					j.isNumber(e) && (e = this.slidesContainer.querySelectorAll(".gslide")[e]);
					var t = e.querySelector(".gvideo");
					if (!t) return !1;
					var i = t.id;
					if (O && O.hasOwnProperty(i)) {
						var n = O[i];
						l(t, "vimeo-video") && n.pause(), l(t, "youtube-video") && n.pauseVideo(), l(t, "jw-video") && n.pause(!0), l(t, "html5-video") && n.pause()
					}
				}
			}, {
				key: "playSlideVideo",
				value: function (e) {
					j.isNumber(e) && (e = this.slidesContainer.querySelectorAll(".gslide")[e]);
					var t = e.querySelector(".gvideo");
					if (!t) return !1;
					var i = t.id;
					if (O && O.hasOwnProperty(i)) {
						var n = O[i];
						return l(t, "vimeo-video") && n.play(), l(t, "youtube-video") && n.playVideo(), l(t, "jw-video") && n.play(), l(t, "html5-video") && n.play(), setTimeout(function () {
							o(t, "wait-autoplay")
						}, 300), !1
					}
				}
			}, {
				key: "getElements",
				value: function () {
					var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
					if (this.elements = [], !j.isNil(this.settings.elements) && j.isArray(this.settings.elements)) return this.settings.elements;
					var t = !1;
					if (null !== e) {
						var i = e.getAttribute("data-gallery");
						i && "" !== i && document.querySelectorAll('[data-gallery="undefined"]')
					}
					return 0 == t && (t = document.querySelectorAll("." + this.settings.selector)), t = Array.prototype.slice.call(t)
				}
			}, {
				key: "getActiveSlide",
				value: function () {
					return this.slidesContainer.querySelectorAll(".gslide")[this.index]
				}
			}, {
				key: "getActiveSlideIndex",
				value: function () {
					return this.index
				}
			}, {
				key: "getAnimationClasses",
				value: function () {
					var e = [];
					for (var t in this.settings.cssEfects)
						if (this.settings.cssEfects.hasOwnProperty(t)) {
							var i = this.settings.cssEfects[t];
							e.push("g" + i.in), e.push("g" + i.out)
						}
					return e.join(" ")
				}
			}, {
				key: "build",
				value: function () {
					var e = this,
						t = a(this.settings.lightboxHtml);
					document.body.appendChild(t);
					var o = document.getElementById("glightbox-body");
					this.modal = o;
					var l = o.querySelector(".gclose");
					this.prevButton = o.querySelector(".gprev"), this.nextButton = o.querySelector(".gnext"), this.overlay = o.querySelector(".goverlay"), this.loader = o.querySelector(".gloader"), this.slidesContainer = document.getElementById("glightbox-slider"), this.events = {}, s(this.modal, "glightbox-" + this.settings.skin), this.settings.closeButton && l && (this.events.close = n("click", {
						onElement: l,
						withCallback: function (t, i) {
							t.preventDefault(), e.close()
						}
					})), this.nextButton && (this.events.next = n("click", {
						onElement: this.nextButton,
						withCallback: function (t, i) {
							t.preventDefault(), e.nextSlide()
						}
					})), this.prevButton && (this.events.prev = n("click", {
						onElement: this.prevButton,
						withCallback: function (t, i) {
							t.preventDefault(), e.prevSlide()
						}
					})), i(this.elements, function () {
						var t = a(e.settings.slideHtml);
						e.slidesContainer.appendChild(t)
					}), k && s(E, "glightbox-touch")
				}
			}, {
				key: "close",
				value: function () {
					var e = this;
					this.stopSlideVideo(this.activeSlide), s(this.modal, "glightbox-closing"), r(this.overlay, this.settings.cssEfects.fade.out), r(this.activeSlide, this.settings.cssEfects.zoom.out, function () {
						if (e.activeSlide = null, e.prevActiveSlideIndex = null, e.prevActiveSlide = null, e.events)
							for (var t in e.events) e.events.hasOwnProperty(t) && e.events[t].destroy();
						o(C, "glightbox-open"), o(E, "glightbox-open"), o(C, "touching"), o(C, "gdesc-open"), C.style.width = "", e.modal.parentNode.removeChild(e.modal), j.isFunction(e.settings.onClose) && e.settings.onClose()
					})
				}
			}, {
				key: "destroy",
				value: function () {
					this.close(), this.baseEvents.destroy()
				}
			}]), e
		}();
	e.exports = function () {
		var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
			t = new M(e);
		return t.init(), t
	}
});;
! function (a, b, c, d) {
	"use strict";

	function e(a, b, c) {
		return setTimeout(j(a, c), b)
	}

	function f(a, b, c) {
		return Array.isArray(a) ? (g(a, c[b], c), !0) : !1
	}

	function g(a, b, c) {
		var e;
		if (a)
			if (a.forEach) a.forEach(b, c);
			else if (a.length !== d)
			for (e = 0; e < a.length;) b.call(c, a[e], e, a), e++;
		else
			for (e in a) a.hasOwnProperty(e) && b.call(c, a[e], e, a)
	}

	function h(b, c, d) {
		var e = "DEPRECATED METHOD: " + c + "\n" + d + " AT \n";
		return function () {
			var c = new Error("get-stack-trace"),
				d = c && c.stack ? c.stack.replace(/^[^\(]+?[\n$]/gm, "").replace(/^\s+at\s+/gm, "").replace(/^Object.<anonymous>\s*\(/gm, "{anonymous}()@") : "Unknown Stack Trace",
				f = a.console && (a.console.warn || a.console.log);
			return f && f.call(a.console, e, d), b.apply(this, arguments)
		}
	}

	function i(a, b, c) {
		var d, e = b.prototype;
		d = a.prototype = Object.create(e), d.constructor = a, d._super = e, c && la(d, c)
	}

	function j(a, b) {
		return function () {
			return a.apply(b, arguments)
		}
	}

	function k(a, b) {
		return typeof a == oa ? a.apply(b ? b[0] || d : d, b) : a
	}

	function l(a, b) {
		return a === d ? b : a
	}

	function m(a, b, c) {
		g(q(b), function (b) {
			a.addEventListener(b, c, !1)
		})
	}

	function n(a, b, c) {
		g(q(b), function (b) {
			a.removeEventListener(b, c, !1)
		})
	}

	function o(a, b) {
		for (; a;) {
			if (a == b) return !0;
			a = a.parentNode
		}
		return !1
	}

	function p(a, b) {
		return a.indexOf(b) > -1
	}

	function q(a) {
		return a.trim().split(/\s+/g)
	}

	function r(a, b, c) {
		if (a.indexOf && !c) return a.indexOf(b);
		for (var d = 0; d < a.length;) {
			if (c && a[d][c] == b || !c && a[d] === b) return d;
			d++
		}
		return -1
	}

	function s(a) {
		return Array.prototype.slice.call(a, 0)
	}

	function t(a, b, c) {
		for (var d = [], e = [], f = 0; f < a.length;) {
			var g = b ? a[f][b] : a[f];
			r(e, g) < 0 && d.push(a[f]), e[f] = g, f++
		}
		return c && (d = b ? d.sort(function (a, c) {
			return a[b] > c[b]
		}) : d.sort()), d
	}

	function u(a, b) {
		for (var c, e, f = b[0].toUpperCase() + b.slice(1), g = 0; g < ma.length;) {
			if (c = ma[g], e = c ? c + f : b, e in a) return e;
			g++
		}
		return d
	}

	function v() {
		return ua++
	}

	function w(b) {
		var c = b.ownerDocument || b;
		return c.defaultView || c.parentWindow || a
	}

	function x(a, b) {
		var c = this;
		this.manager = a, this.callback = b, this.element = a.element, this.target = a.options.inputTarget, this.domHandler = function (b) {
			k(a.options.enable, [a]) && c.handler(b)
		}, this.init()
	}

	function y(a) {
		var b, c = a.options.inputClass;
		return new(b = c ? c : xa ? M : ya ? P : wa ? R : L)(a, z)
	}

	function z(a, b, c) {
		var d = c.pointers.length,
			e = c.changedPointers.length,
			f = b & Ea && d - e === 0,
			g = b & (Ga | Ha) && d - e === 0;
		c.isFirst = !!f, c.isFinal = !!g, f && (a.session = {}), c.eventType = b, A(a, c), a.emit("hammer.input", c), a.recognize(c), a.session.prevInput = c
	}

	function A(a, b) {
		var c = a.session,
			d = b.pointers,
			e = d.length;
		c.firstInput || (c.firstInput = D(b)), e > 1 && !c.firstMultiple ? c.firstMultiple = D(b) : 1 === e && (c.firstMultiple = !1);
		var f = c.firstInput,
			g = c.firstMultiple,
			h = g ? g.center : f.center,
			i = b.center = E(d);
		b.timeStamp = ra(), b.deltaTime = b.timeStamp - f.timeStamp, b.angle = I(h, i), b.distance = H(h, i), B(c, b), b.offsetDirection = G(b.deltaX, b.deltaY);
		var j = F(b.deltaTime, b.deltaX, b.deltaY);
		b.overallVelocityX = j.x, b.overallVelocityY = j.y, b.overallVelocity = qa(j.x) > qa(j.y) ? j.x : j.y, b.scale = g ? K(g.pointers, d) : 1, b.rotation = g ? J(g.pointers, d) : 0, b.maxPointers = c.prevInput ? b.pointers.length > c.prevInput.maxPointers ? b.pointers.length : c.prevInput.maxPointers : b.pointers.length, C(c, b);
		var k = a.element;
		o(b.srcEvent.target, k) && (k = b.srcEvent.target), b.target = k
	}

	function B(a, b) {
		var c = b.center,
			d = a.offsetDelta || {},
			e = a.prevDelta || {},
			f = a.prevInput || {};
		b.eventType !== Ea && f.eventType !== Ga || (e = a.prevDelta = {
			x: f.deltaX || 0,
			y: f.deltaY || 0
		}, d = a.offsetDelta = {
			x: c.x,
			y: c.y
		}), b.deltaX = e.x + (c.x - d.x), b.deltaY = e.y + (c.y - d.y)
	}

	function C(a, b) {
		var c, e, f, g, h = a.lastInterval || b,
			i = b.timeStamp - h.timeStamp;
		if (b.eventType != Ha && (i > Da || h.velocity === d)) {
			var j = b.deltaX - h.deltaX,
				k = b.deltaY - h.deltaY,
				l = F(i, j, k);
			e = l.x, f = l.y, c = qa(l.x) > qa(l.y) ? l.x : l.y, g = G(j, k), a.lastInterval = b
		} else c = h.velocity, e = h.velocityX, f = h.velocityY, g = h.direction;
		b.velocity = c, b.velocityX = e, b.velocityY = f, b.direction = g
	}

	function D(a) {
		for (var b = [], c = 0; c < a.pointers.length;) b[c] = {
			clientX: pa(a.pointers[c].clientX),
			clientY: pa(a.pointers[c].clientY)
		}, c++;
		return {
			timeStamp: ra(),
			pointers: b,
			center: E(b),
			deltaX: a.deltaX,
			deltaY: a.deltaY
		}
	}

	function E(a) {
		var b = a.length;
		if (1 === b) return {
			x: pa(a[0].clientX),
			y: pa(a[0].clientY)
		};
		for (var c = 0, d = 0, e = 0; b > e;) c += a[e].clientX, d += a[e].clientY, e++;
		return {
			x: pa(c / b),
			y: pa(d / b)
		}
	}

	function F(a, b, c) {
		return {
			x: b / a || 0,
			y: c / a || 0
		}
	}

	function G(a, b) {
		return a === b ? Ia : qa(a) >= qa(b) ? 0 > a ? Ja : Ka : 0 > b ? La : Ma
	}

	function H(a, b, c) {
		c || (c = Qa);
		var d = b[c[0]] - a[c[0]],
			e = b[c[1]] - a[c[1]];
		return Math.sqrt(d * d + e * e)
	}

	function I(a, b, c) {
		c || (c = Qa);
		var d = b[c[0]] - a[c[0]],
			e = b[c[1]] - a[c[1]];
		return 180 * Math.atan2(e, d) / Math.PI
	}

	function J(a, b) {
		return I(b[1], b[0], Ra) + I(a[1], a[0], Ra)
	}

	function K(a, b) {
		return H(b[0], b[1], Ra) / H(a[0], a[1], Ra)
	}

	function L() {
		this.evEl = Ta, this.evWin = Ua, this.pressed = !1, x.apply(this, arguments)
	}

	function M() {
		this.evEl = Xa, this.evWin = Ya, x.apply(this, arguments), this.store = this.manager.session.pointerEvents = []
	}

	function N() {
		this.evTarget = $a, this.evWin = _a, this.started = !1, x.apply(this, arguments)
	}

	function O(a, b) {
		var c = s(a.touches),
			d = s(a.changedTouches);
		return b & (Ga | Ha) && (c = t(c.concat(d), "identifier", !0)), [c, d]
	}

	function P() {
		this.evTarget = bb, this.targetIds = {}, x.apply(this, arguments)
	}

	function Q(a, b) {
		var c = s(a.touches),
			d = this.targetIds;
		if (b & (Ea | Fa) && 1 === c.length) return d[c[0].identifier] = !0, [c, c];
		var e, f, g = s(a.changedTouches),
			h = [],
			i = this.target;
		if (f = c.filter(function (a) {
				return o(a.target, i)
			}), b === Ea)
			for (e = 0; e < f.length;) d[f[e].identifier] = !0, e++;
		for (e = 0; e < g.length;) d[g[e].identifier] && h.push(g[e]), b & (Ga | Ha) && delete d[g[e].identifier], e++;
		return h.length ? [t(f.concat(h), "identifier", !0), h] : void 0
	}

	function R() {
		x.apply(this, arguments);
		var a = j(this.handler, this);
		this.touch = new P(this.manager, a), this.mouse = new L(this.manager, a), this.primaryTouch = null, this.lastTouches = []
	}

	function S(a, b) {
		a & Ea ? (this.primaryTouch = b.changedPointers[0].identifier, T.call(this, b)) : a & (Ga | Ha) && T.call(this, b)
	}

	function T(a) {
		var b = a.changedPointers[0];
		if (b.identifier === this.primaryTouch) {
			var c = {
				x: b.clientX,
				y: b.clientY
			};
			this.lastTouches.push(c);
			var d = this.lastTouches,
				e = function () {
					var a = d.indexOf(c);
					a > -1 && d.splice(a, 1)
				};
			setTimeout(e, cb)
		}
	}

	function U(a) {
		for (var b = a.srcEvent.clientX, c = a.srcEvent.clientY, d = 0; d < this.lastTouches.length; d++) {
			var e = this.lastTouches[d],
				f = Math.abs(b - e.x),
				g = Math.abs(c - e.y);
			if (db >= f && db >= g) return !0
		}
		return !1
	}

	function V(a, b) {
		this.manager = a, this.set(b)
	}

	function W(a) {
		if (p(a, jb)) return jb;
		var b = p(a, kb),
			c = p(a, lb);
		return b && c ? jb : b || c ? b ? kb : lb : p(a, ib) ? ib : hb
	}

	function X() {
		if (!fb) return !1;
		var b = {},
			c = a.CSS && a.CSS.supports;
		return ["auto", "manipulation", "pan-y", "pan-x", "pan-x pan-y", "none"].forEach(function (d) {
			b[d] = c ? a.CSS.supports("touch-action", d) : !0
		}), b
	}

	function Y(a) {
		this.options = la({}, this.defaults, a || {}), this.id = v(), this.manager = null, this.options.enable = l(this.options.enable, !0), this.state = nb, this.simultaneous = {}, this.requireFail = []
	}

	function Z(a) {
		return a & sb ? "cancel" : a & qb ? "end" : a & pb ? "move" : a & ob ? "start" : ""
	}

	function $(a) {
		return a == Ma ? "down" : a == La ? "up" : a == Ja ? "left" : a == Ka ? "right" : ""
	}

	function _(a, b) {
		var c = b.manager;
		return c ? c.get(a) : a
	}

	function aa() {
		Y.apply(this, arguments)
	}

	function ba() {
		aa.apply(this, arguments), this.pX = null, this.pY = null
	}

	function ca() {
		aa.apply(this, arguments)
	}

	function da() {
		Y.apply(this, arguments), this._timer = null, this._input = null
	}

	function ea() {
		aa.apply(this, arguments)
	}

	function fa() {
		aa.apply(this, arguments)
	}

	function ga() {
		Y.apply(this, arguments), this.pTime = !1, this.pCenter = !1, this._timer = null, this._input = null, this.count = 0
	}

	function ha(a, b) {
		return b = b || {}, b.recognizers = l(b.recognizers, ha.defaults.preset), new ia(a, b)
	}

	function ia(a, b) {
		this.options = la({}, ha.defaults, b || {}), this.options.inputTarget = this.options.inputTarget || a, this.handlers = {}, this.session = {}, this.recognizers = [], this.oldCssProps = {}, this.element = a, this.input = y(this), this.touchAction = new V(this, this.options.touchAction), ja(this, !0), g(this.options.recognizers, function (a) {
			var b = this.add(new a[0](a[1]));
			a[2] && b.recognizeWith(a[2]), a[3] && b.requireFailure(a[3])
		}, this)
	}

	function ja(a, b) {
		var c = a.element;
		if (c.style) {
			var d;
			g(a.options.cssProps, function (e, f) {
				d = u(c.style, f), b ? (a.oldCssProps[d] = c.style[d], c.style[d] = e) : c.style[d] = a.oldCssProps[d] || ""
			}), b || (a.oldCssProps = {})
		}
	}

	function ka(a, c) {
		var d = b.createEvent("Event");
		d.initEvent(a, !0, !0), d.gesture = c, c.target.dispatchEvent(d)
	}
	var la, ma = ["", "webkit", "Moz", "MS", "ms", "o"],
		na = b.createElement("div"),
		oa = "function",
		pa = Math.round,
		qa = Math.abs,
		ra = Date.now;
	la = "function" != typeof Object.assign ? function (a) {
		if (a === d || null === a) throw new TypeError("Cannot convert undefined or null to object");
		for (var b = Object(a), c = 1; c < arguments.length; c++) {
			var e = arguments[c];
			if (e !== d && null !== e)
				for (var f in e) e.hasOwnProperty(f) && (b[f] = e[f])
		}
		return b
	} : Object.assign;
	var sa = h(function (a, b, c) {
			for (var e = Object.keys(b), f = 0; f < e.length;)(!c || c && a[e[f]] === d) && (a[e[f]] = b[e[f]]), f++;
			return a
		}, "extend", "Use `assign`."),
		ta = h(function (a, b) {
			return sa(a, b, !0)
		}, "merge", "Use `assign`."),
		ua = 1,
		va = /mobile|tablet|ip(ad|hone|od)|android/i,
		wa = "ontouchstart" in a,
		xa = u(a, "PointerEvent") !== d,
		ya = wa && va.test(navigator.userAgent),
		za = "touch",
		Aa = "pen",
		Ba = "mouse",
		Ca = "kinect",
		Da = 25,
		Ea = 1,
		Fa = 2,
		Ga = 4,
		Ha = 8,
		Ia = 1,
		Ja = 2,
		Ka = 4,
		La = 8,
		Ma = 16,
		Na = Ja | Ka,
		Oa = La | Ma,
		Pa = Na | Oa,
		Qa = ["x", "y"],
		Ra = ["clientX", "clientY"];
	x.prototype = {
		handler: function () {},
		init: function () {
			this.evEl && m(this.element, this.evEl, this.domHandler), this.evTarget && m(this.target, this.evTarget, this.domHandler), this.evWin && m(w(this.element), this.evWin, this.domHandler)
		},
		destroy: function () {
			this.evEl && n(this.element, this.evEl, this.domHandler), this.evTarget && n(this.target, this.evTarget, this.domHandler), this.evWin && n(w(this.element), this.evWin, this.domHandler)
		}
	};
	var Sa = {
			mousedown: Ea,
			mousemove: Fa,
			mouseup: Ga
		},
		Ta = "mousedown",
		Ua = "mousemove mouseup";
	i(L, x, {
		handler: function (a) {
			var b = Sa[a.type];
			b & Ea && 0 === a.button && (this.pressed = !0), b & Fa && 1 !== a.which && (b = Ga), this.pressed && (b & Ga && (this.pressed = !1), this.callback(this.manager, b, {
				pointers: [a],
				changedPointers: [a],
				pointerType: Ba,
				srcEvent: a
			}))
		}
	});
	var Va = {
			pointerdown: Ea,
			pointermove: Fa,
			pointerup: Ga,
			pointercancel: Ha,
			pointerout: Ha
		},
		Wa = {
			2: za,
			3: Aa,
			4: Ba,
			5: Ca
		},
		Xa = "pointerdown",
		Ya = "pointermove pointerup pointercancel";
	a.MSPointerEvent && !a.PointerEvent && (Xa = "MSPointerDown", Ya = "MSPointerMove MSPointerUp MSPointerCancel"), i(M, x, {
		handler: function (a) {
			var b = this.store,
				c = !1,
				d = a.type.toLowerCase().replace("ms", ""),
				e = Va[d],
				f = Wa[a.pointerType] || a.pointerType,
				g = f == za,
				h = r(b, a.pointerId, "pointerId");
			e & Ea && (0 === a.button || g) ? 0 > h && (b.push(a), h = b.length - 1) : e & (Ga | Ha) && (c = !0), 0 > h || (b[h] = a, this.callback(this.manager, e, {
				pointers: b,
				changedPointers: [a],
				pointerType: f,
				srcEvent: a
			}), c && b.splice(h, 1))
		}
	});
	var Za = {
			touchstart: Ea,
			touchmove: Fa,
			touchend: Ga,
			touchcancel: Ha
		},
		$a = "touchstart",
		_a = "touchstart touchmove touchend touchcancel";
	i(N, x, {
		handler: function (a) {
			var b = Za[a.type];
			if (b === Ea && (this.started = !0), this.started) {
				var c = O.call(this, a, b);
				b & (Ga | Ha) && c[0].length - c[1].length === 0 && (this.started = !1), this.callback(this.manager, b, {
					pointers: c[0],
					changedPointers: c[1],
					pointerType: za,
					srcEvent: a
				})
			}
		}
	});
	var ab = {
			touchstart: Ea,
			touchmove: Fa,
			touchend: Ga,
			touchcancel: Ha
		},
		bb = "touchstart touchmove touchend touchcancel";
	i(P, x, {
		handler: function (a) {
			var b = ab[a.type],
				c = Q.call(this, a, b);
			c && this.callback(this.manager, b, {
				pointers: c[0],
				changedPointers: c[1],
				pointerType: za,
				srcEvent: a
			})
		}
	});
	var cb = 2500,
		db = 25;
	i(R, x, {
		handler: function (a, b, c) {
			var d = c.pointerType == za,
				e = c.pointerType == Ba;
			if (!(e && c.sourceCapabilities && c.sourceCapabilities.firesTouchEvents)) {
				if (d) S.call(this, b, c);
				else if (e && U.call(this, c)) return;
				this.callback(a, b, c)
			}
		},
		destroy: function () {
			this.touch.destroy(), this.mouse.destroy()
		}
	});
	var eb = u(na.style, "touchAction"),
		fb = eb !== d,
		gb = "compute",
		hb = "auto",
		ib = "manipulation",
		jb = "none",
		kb = "pan-x",
		lb = "pan-y",
		mb = X();
	V.prototype = {
		set: function (a) {
			a == gb && (a = this.compute()), fb && this.manager.element.style && mb[a] && (this.manager.element.style[eb] = a), this.actions = a.toLowerCase().trim()
		},
		update: function () {
			this.set(this.manager.options.touchAction)
		},
		compute: function () {
			var a = [];
			return g(this.manager.recognizers, function (b) {
				k(b.options.enable, [b]) && (a = a.concat(b.getTouchAction()))
			}), W(a.join(" "))
		},
		preventDefaults: function (a) {
			var b = a.srcEvent,
				c = a.offsetDirection;
			if (this.manager.session.prevented) return void b.preventDefault();
			var d = this.actions,
				e = p(d, jb) && !mb[jb],
				f = p(d, lb) && !mb[lb],
				g = p(d, kb) && !mb[kb];
			if (e) {
				var h = 1 === a.pointers.length,
					i = a.distance < 2,
					j = a.deltaTime < 250;
				if (h && i && j) return
			}
			return g && f ? void 0 : e || f && c & Na || g && c & Oa ? this.preventSrc(b) : void 0
		},
		preventSrc: function (a) {
			this.manager.session.prevented = !0, a.preventDefault()
		}
	};
	var nb = 1,
		ob = 2,
		pb = 4,
		qb = 8,
		rb = qb,
		sb = 16,
		tb = 32;
	Y.prototype = {
		defaults: {},
		set: function (a) {
			return la(this.options, a), this.manager && this.manager.touchAction.update(), this
		},
		recognizeWith: function (a) {
			if (f(a, "recognizeWith", this)) return this;
			var b = this.simultaneous;
			return a = _(a, this), b[a.id] || (b[a.id] = a, a.recognizeWith(this)), this
		},
		dropRecognizeWith: function (a) {
			return f(a, "dropRecognizeWith", this) ? this : (a = _(a, this), delete this.simultaneous[a.id], this)
		},
		requireFailure: function (a) {
			if (f(a, "requireFailure", this)) return this;
			var b = this.requireFail;
			return a = _(a, this), -1 === r(b, a) && (b.push(a), a.requireFailure(this)), this
		},
		dropRequireFailure: function (a) {
			if (f(a, "dropRequireFailure", this)) return this;
			a = _(a, this);
			var b = r(this.requireFail, a);
			return b > -1 && this.requireFail.splice(b, 1), this
		},
		hasRequireFailures: function () {
			return this.requireFail.length > 0
		},
		canRecognizeWith: function (a) {
			return !!this.simultaneous[a.id]
		},
		emit: function (a) {
			function b(b) {
				c.manager.emit(b, a)
			}
			var c = this,
				d = this.state;
			qb > d && b(c.options.event + Z(d)), b(c.options.event), a.additionalEvent && b(a.additionalEvent), d >= qb && b(c.options.event + Z(d))
		},
		tryEmit: function (a) {
			return this.canEmit() ? this.emit(a) : void(this.state = tb)
		},
		canEmit: function () {
			for (var a = 0; a < this.requireFail.length;) {
				if (!(this.requireFail[a].state & (tb | nb))) return !1;
				a++
			}
			return !0
		},
		recognize: function (a) {
			var b = la({}, a);
			return k(this.options.enable, [this, b]) ? (this.state & (rb | sb | tb) && (this.state = nb), this.state = this.process(b), void(this.state & (ob | pb | qb | sb) && this.tryEmit(b))) : (this.reset(), void(this.state = tb))
		},
		process: function (a) {},
		getTouchAction: function () {},
		reset: function () {}
	}, i(aa, Y, {
		defaults: {
			pointers: 1
		},
		attrTest: function (a) {
			var b = this.options.pointers;
			return 0 === b || a.pointers.length === b
		},
		process: function (a) {
			var b = this.state,
				c = a.eventType,
				d = b & (ob | pb),
				e = this.attrTest(a);
			return d && (c & Ha || !e) ? b | sb : d || e ? c & Ga ? b | qb : b & ob ? b | pb : ob : tb
		}
	}), i(ba, aa, {
		defaults: {
			event: "pan",
			threshold: 10,
			pointers: 1,
			direction: Pa
		},
		getTouchAction: function () {
			var a = this.options.direction,
				b = [];
			return a & Na && b.push(lb), a & Oa && b.push(kb), b
		},
		directionTest: function (a) {
			var b = this.options,
				c = !0,
				d = a.distance,
				e = a.direction,
				f = a.deltaX,
				g = a.deltaY;
			return e & b.direction || (b.direction & Na ? (e = 0 === f ? Ia : 0 > f ? Ja : Ka, c = f != this.pX, d = Math.abs(a.deltaX)) : (e = 0 === g ? Ia : 0 > g ? La : Ma, c = g != this.pY, d = Math.abs(a.deltaY))), a.direction = e, c && d > b.threshold && e & b.direction
		},
		attrTest: function (a) {
			return aa.prototype.attrTest.call(this, a) && (this.state & ob || !(this.state & ob) && this.directionTest(a))
		},
		emit: function (a) {
			this.pX = a.deltaX, this.pY = a.deltaY;
			var b = $(a.direction);
			b && (a.additionalEvent = this.options.event + b), this._super.emit.call(this, a)
		}
	}), i(ca, aa, {
		defaults: {
			event: "pinch",
			threshold: 0,
			pointers: 2
		},
		getTouchAction: function () {
			return [jb]
		},
		attrTest: function (a) {
			return this._super.attrTest.call(this, a) && (Math.abs(a.scale - 1) > this.options.threshold || this.state & ob)
		},
		emit: function (a) {
			if (1 !== a.scale) {
				var b = a.scale < 1 ? "in" : "out";
				a.additionalEvent = this.options.event + b
			}
			this._super.emit.call(this, a)
		}
	}), i(da, Y, {
		defaults: {
			event: "press",
			pointers: 1,
			time: 251,
			threshold: 9
		},
		getTouchAction: function () {
			return [hb]
		},
		process: function (a) {
			var b = this.options,
				c = a.pointers.length === b.pointers,
				d = a.distance < b.threshold,
				f = a.deltaTime > b.time;
			if (this._input = a, !d || !c || a.eventType & (Ga | Ha) && !f) this.reset();
			else if (a.eventType & Ea) this.reset(), this._timer = e(function () {
				this.state = rb, this.tryEmit()
			}, b.time, this);
			else if (a.eventType & Ga) return rb;
			return tb
		},
		reset: function () {
			clearTimeout(this._timer)
		},
		emit: function (a) {
			this.state === rb && (a && a.eventType & Ga ? this.manager.emit(this.options.event + "up", a) : (this._input.timeStamp = ra(), this.manager.emit(this.options.event, this._input)))
		}
	}), i(ea, aa, {
		defaults: {
			event: "rotate",
			threshold: 0,
			pointers: 2
		},
		getTouchAction: function () {
			return [jb]
		},
		attrTest: function (a) {
			return this._super.attrTest.call(this, a) && (Math.abs(a.rotation) > this.options.threshold || this.state & ob)
		}
	}), i(fa, aa, {
		defaults: {
			event: "swipe",
			threshold: 10,
			velocity: .3,
			direction: Na | Oa,
			pointers: 1
		},
		getTouchAction: function () {
			return ba.prototype.getTouchAction.call(this)
		},
		attrTest: function (a) {
			var b, c = this.options.direction;
			return c & (Na | Oa) ? b = a.overallVelocity : c & Na ? b = a.overallVelocityX : c & Oa && (b = a.overallVelocityY), this._super.attrTest.call(this, a) && c & a.offsetDirection && a.distance > this.options.threshold && a.maxPointers == this.options.pointers && qa(b) > this.options.velocity && a.eventType & Ga
		},
		emit: function (a) {
			var b = $(a.offsetDirection);
			b && this.manager.emit(this.options.event + b, a), this.manager.emit(this.options.event, a)
		}
	}), i(ga, Y, {
		defaults: {
			event: "tap",
			pointers: 1,
			taps: 1,
			interval: 300,
			time: 250,
			threshold: 9,
			posThreshold: 10
		},
		getTouchAction: function () {
			return [ib]
		},
		process: function (a) {
			var b = this.options,
				c = a.pointers.length === b.pointers,
				d = a.distance < b.threshold,
				f = a.deltaTime < b.time;
			if (this.reset(), a.eventType & Ea && 0 === this.count) return this.failTimeout();
			if (d && f && c) {
				if (a.eventType != Ga) return this.failTimeout();
				var g = this.pTime ? a.timeStamp - this.pTime < b.interval : !0,
					h = !this.pCenter || H(this.pCenter, a.center) < b.posThreshold;
				this.pTime = a.timeStamp, this.pCenter = a.center, h && g ? this.count += 1 : this.count = 1, this._input = a;
				var i = this.count % b.taps;
				if (0 === i) return this.hasRequireFailures() ? (this._timer = e(function () {
					this.state = rb, this.tryEmit()
				}, b.interval, this), ob) : rb
			}
			return tb
		},
		failTimeout: function () {
			return this._timer = e(function () {
				this.state = tb
			}, this.options.interval, this), tb
		},
		reset: function () {
			clearTimeout(this._timer)
		},
		emit: function () {
			this.state == rb && (this._input.tapCount = this.count, this.manager.emit(this.options.event, this._input))
		}
	}), ha.VERSION = "2.0.8", ha.defaults = {
		domEvents: !1,
		touchAction: gb,
		enable: !0,
		inputTarget: null,
		inputClass: null,
		preset: [
			[ea, {
				enable: !1
			}],
			[ca, {
					enable: !1
				},
				["rotate"]
			],
			[fa, {
				direction: Na
			}],
			[ba, {
					direction: Na
				},
				["swipe"]
			],
			[ga],
			[ga, {
					event: "doubletap",
					taps: 2
				},
				["tap"]
			],
			[da]
		],
		cssProps: {
			userSelect: "none",
			touchSelect: "none",
			touchCallout: "none",
			contentZooming: "none",
			userDrag: "none",
			tapHighlightColor: "rgba(0,0,0,0)"
		}
	};
	var ub = 1,
		vb = 2;
	ia.prototype = {
		set: function (a) {
			return la(this.options, a), a.touchAction && this.touchAction.update(), a.inputTarget && (this.input.destroy(), this.input.target = a.inputTarget, this.input.init()), this
		},
		stop: function (a) {
			this.session.stopped = a ? vb : ub
		},
		recognize: function (a) {
			var b = this.session;
			if (!b.stopped) {
				this.touchAction.preventDefaults(a);
				var c, d = this.recognizers,
					e = b.curRecognizer;
				(!e || e && e.state & rb) && (e = b.curRecognizer = null);
				for (var f = 0; f < d.length;) c = d[f], b.stopped === vb || e && c != e && !c.canRecognizeWith(e) ? c.reset() : c.recognize(a), !e && c.state & (ob | pb | qb) && (e = b.curRecognizer = c), f++
			}
		},
		get: function (a) {
			if (a instanceof Y) return a;
			for (var b = this.recognizers, c = 0; c < b.length; c++)
				if (b[c].options.event == a) return b[c];
			return null
		},
		add: function (a) {
			if (f(a, "add", this)) return this;
			var b = this.get(a.options.event);
			return b && this.remove(b), this.recognizers.push(a), a.manager = this, this.touchAction.update(), a
		},
		remove: function (a) {
			if (f(a, "remove", this)) return this;
			if (a = this.get(a)) {
				var b = this.recognizers,
					c = r(b, a); - 1 !== c && (b.splice(c, 1), this.touchAction.update())
			}
			return this
		},
		on: function (a, b) {
			if (a !== d && b !== d) {
				var c = this.handlers;
				return g(q(a), function (a) {
					c[a] = c[a] || [], c[a].push(b)
				}), this
			}
		},
		off: function (a, b) {
			if (a !== d) {
				var c = this.handlers;
				return g(q(a), function (a) {
					b ? c[a] && c[a].splice(r(c[a], b), 1) : delete c[a]
				}), this
			}
		},
		emit: function (a, b) {
			this.options.domEvents && ka(a, b);
			var c = this.handlers[a] && this.handlers[a].slice();
			if (c && c.length) {
				b.type = a, b.preventDefault = function () {
					b.srcEvent.preventDefault()
				};
				for (var d = 0; d < c.length;) c[d](b), d++
			}
		},
		destroy: function () {
			this.element && ja(this, !1), this.handlers = {}, this.session = {}, this.input.destroy(), this.element = null
		}
	}, la(ha, {
		INPUT_START: Ea,
		INPUT_MOVE: Fa,
		INPUT_END: Ga,
		INPUT_CANCEL: Ha,
		STATE_POSSIBLE: nb,
		STATE_BEGAN: ob,
		STATE_CHANGED: pb,
		STATE_ENDED: qb,
		STATE_RECOGNIZED: rb,
		STATE_CANCELLED: sb,
		STATE_FAILED: tb,
		DIRECTION_NONE: Ia,
		DIRECTION_LEFT: Ja,
		DIRECTION_RIGHT: Ka,
		DIRECTION_UP: La,
		DIRECTION_DOWN: Ma,
		DIRECTION_HORIZONTAL: Na,
		DIRECTION_VERTICAL: Oa,
		DIRECTION_ALL: Pa,
		Manager: ia,
		Input: x,
		TouchAction: V,
		TouchInput: P,
		MouseInput: L,
		PointerEventInput: M,
		TouchMouseInput: R,
		SingleTouchInput: N,
		Recognizer: Y,
		AttrRecognizer: aa,
		Tap: ga,
		Pan: ba,
		Swipe: fa,
		Pinch: ca,
		Rotate: ea,
		Press: da,
		on: m,
		off: n,
		each: g,
		merge: ta,
		extend: sa,
		assign: la,
		inherit: i,
		bindFn: j,
		prefixed: u
	});
	var wb = "undefined" != typeof a ? a : "undefined" != typeof self ? self : {};
	wb.Hammer = ha, "function" == typeof define && define.amd ? define(function () {
		return ha
	}) : "undefined" != typeof module && module.exports ? module.exports = ha : a[c] = ha
}(window, document, "Hammer");;
(function () {
	function aI() {
		if (aI.is(arguments[0], a7)) {
			var b = arguments[0],
				d = F[bB](aI, b.splice(0, 4 + aI.is(b[0], aF))),
				R = d.set();
			for (var E = 0, S = b[s]; E < S; E++) {
				var e = b[E] || {};
				bp[ag](e.type) && R[k](d[e.type]().attr(e))
			}
			return R
		}
		return F[bB](aI, arguments)
	}
	aI.version = "1.5.2";
	var a = /[, ]+/,
		bp = {
			circle: 1,
			rect: 1,
			path: 1,
			ellipse: 1,
			text: 1,
			image: 1
		},
		bn = /\{(\d+)\}/g,
		bE = "prototype",
		ag = "hasOwnProperty",
		aa = document,
		aQ = window,
		r = {
			was: Object[bE][ag].call(aQ, "Raphael"),
			is: aQ.Raphael
		},
		bz = function () {
			this.customAttributes = {}
		},
		aZ, bk = "appendChild",
		bB = "apply",
		bw = "concat",
		W = "createTouch" in aa,
		aP = "",
		aH = " ",
		bC = String,
		I = "split",
		Q = "click dblclick mousedown mousemove mouseout mouseover mouseup touchstart touchmove touchend orientationchange touchcancel gesturestart gesturechange gestureend" [I](aH),
		bq = {
			mousedown: "touchstart",
			mousemove: "touchmove",
			mouseup: "touchend"
		},
		aW = "join",
		s = "length",
		bG = bC[bE].toLowerCase,
		ao = Math,
		m = ao.max,
		bi = ao.min,
		aq = ao.abs,
		bl = ao.pow,
		aM = ao.PI,
		aF = "number",
		af = "string",
		a7 = "array",
		a0 = "toString",
		a4 = "fill",
		aT = Object[bE][a0],
		bt = {},
		k = "push",
		h = /^url\(['"]?([^\)]+?)['"]?\)$/i,
		G = /^\s*((#[a-f\d]{6})|(#[a-f\d]{3})|rgba?\(\s*([\d\.]+%?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+(?:%?\s*,\s*[\d\.]+)?)%?\s*\)|hsba?\(\s*([\d\.]+(?:deg|\xb0|%)?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+(?:%?\s*,\s*[\d\.]+)?)%?\s*\)|hsla?\(\s*([\d\.]+(?:deg|\xb0|%)?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+(?:%?\s*,\s*[\d\.]+)?)%?\s*\))\s*$/i,
		ap = {
			"NaN": 1,
			"Infinity": 1,
			"-Infinity": 1
		},
		c = /^(?:cubic-)?bezier\(([^,]+),([^,]+),([^,]+),([^\)]+)\)/,
		ad = ao.round,
		D = "setAttribute",
		aj = parseFloat,
		T = parseInt,
		a5 = " progid:DXImageTransform.Microsoft",
		bo = bC[bE].toUpperCase,
		q = {
			blur: 0,
			"clip-rect": "0 0 1e9 1e9",
			cursor: "default",
			cx: 0,
			cy: 0,
			fill: "#fff",
			"fill-opacity": 1,
			font: '10px "Arial"',
			"font-family": '"Arial"',
			"font-size": "10",
			"font-style": "normal",
			"font-weight": 400,
			gradient: 0,
			height: 0,
			href: "http://raphaeljs.com/",
			opacity: 1,
			path: "M0,0",
			r: 0,
			rotation: 0,
			rx: 0,
			ry: 0,
			scale: "1 1",
			src: "",
			stroke: "#000",
			"stroke-dasharray": "",
			"stroke-linecap": "butt",
			"stroke-linejoin": "butt",
			"stroke-miterlimit": 0,
			"stroke-opacity": 1,
			"stroke-width": 1,
			target: "_blank",
			"text-anchor": "middle",
			title: "Raphael",
			translation: "0 0",
			width: 0,
			x: 0,
			y: 0
		},
		am = {
			along: "along",
			blur: aF,
			"clip-rect": "csv",
			cx: aF,
			cy: aF,
			fill: "colour",
			"fill-opacity": aF,
			"font-size": aF,
			height: aF,
			opacity: aF,
			path: "path",
			r: aF,
			rotation: "csv",
			rx: aF,
			ry: aF,
			scale: "csv",
			stroke: "colour",
			"stroke-opacity": aF,
			"stroke-width": aF,
			translation: "csv",
			width: aF,
			x: aF,
			y: aF
		},
		bs = "replace",
		bf = /^(from|to|\d+%?)$/,
		bd = /\s*,\s*/,
		n = {
			hs: 1,
			rg: 1
		},
		ba = /,?([achlmqrstvxz]),?/gi,
		aR = /([achlmqstvz])[\s,]*((-?\d*\.?\d*(?:e[-+]?\d+)?\s*,?\s*)+)/ig,
		aG = /(-?\d*\.?\d*(?:e[-+]?\d+)?)\s*,?\s*/ig,
		aO = /^r(?:\(([^,]+?)\s*,\s*([^\)]+?)\))?/,
		bm = function (e, d) {
			return e.key - d.key
		};
	aI.type = (aQ.SVGAngle || aa.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1") ? "SVG" : "VML");
	if (aI.type == "VML") {
		var ax = aa.createElement("div"),
			aB;
		ax.innerHTML = '<v:shape adj="1"/>';
		aB = ax.firstChild;
		aB.style.behavior = "url(#default#VML)";
		if (!(aB && typeof aB.adj == "object")) {
			return aI.type = null
		}
		ax = null
	}
	aI.svg = !(aI.vml = aI.type == "VML");
	bz[bE] = aI[bE];
	aZ = bz[bE];
	aI._id = 0;
	aI._oid = 0;
	aI.fn = {};
	aI.is = function (d, b) {
		b = bG.call(b);
		if (b == "finite") {
			return !ap[ag](+d)
		}
		return (b == "null" && d === null) || (b == typeof d) || (b == "object" && d === Object(d)) || (b == "array" && Array.isArray && Array.isArray(d)) || aT.call(d).slice(8, -1).toLowerCase() == b
	};
	aI.angle = function (E, S, e, R, d, i) {
		if (d == null) {
			var b = E - e,
				bH = S - R;
			if (!b && !bH) {
				return 0
			}
			return ((b < 0) * 180 + ao.atan(-bH / -b) * 180 / aM + 360) % 360
		} else {
			return aI.angle(E, S, d, i) - aI.angle(e, R, d, i)
		}
	};
	aI.rad = function (b) {
		return b % 360 * aM / 180
	};
	aI.deg = function (b) {
		return b * 180 / aM % 360
	};
	aI.snapTo = function (d, E, b) {
		b = aI.is(b, "finite") ? b : 10;
		if (aI.is(d, a7)) {
			var e = d.length;
			while (e--) {
				if (aq(d[e] - E) <= b) {
					return d[e]
				}
			}
		} else {
			d = +d;
			var R = E % d;
			if (R < b) {
				return E - R
			}
			if (R > d - b) {
				return E - R + d
			}
		}
		return E
	};

	function j() {
		var d = [],
			b = 0;
		for (; b < 32; b++) {
			d[b] = (~~(ao.random() * 16))[a0](16)
		}
		d[12] = 4;
		d[16] = ((d[16] & 3) | 8)[a0](16);
		return "r-" + d[aW]("")
	}
	aI.setWindow = function (b) {
		aQ = b;
		aa = aQ.document
	};
	var a9 = function (E) {
			if (aI.vml) {
				var b = /^\s+|\s+$/g;
				var S;
				try {
					var bH = new ActiveXObject("htmlfile");
					bH.write("<body>");
					bH.close();
					S = bH.body
				} catch (bI) {
					S = createPopup().document.body
				}
				var d = S.createTextRange();
				a9 = aA(function (i) {
					try {
						S.style.color = bC(i)[bs](b, aP);
						var bJ = d.queryCommandValue("ForeColor");
						bJ = ((bJ & 255) << 16) | (bJ & 65280) | ((bJ & 16711680) >>> 16);
						return "#" + ("000000" + bJ[a0](16)).slice(-6)
					} catch (bK) {
						return "none"
					}
				})
			} else {
				var R = aa.createElement("i");
				R.title = "Rapha\xebl Colour Picker";
				R.style.display = "none";
				aa.body[bk](R);
				a9 = aA(function (e) {
					R.style.color = e;
					return aa.defaultView.getComputedStyle(R, aP).getPropertyValue("color")
				})
			}
			return a9(E)
		},
		aC = function () {
			return "hsb(" + [this.h, this.s, this.b] + ")"
		},
		M = function () {
			return "hsl(" + [this.h, this.s, this.l] + ")"
		},
		B = function () {
			return this.hex
		};
	aI.hsb2rgb = function (i, e, d, E) {
		if (aI.is(i, "object") && "h" in i && "s" in i && "b" in i) {
			d = i.b;
			e = i.s;
			i = i.h;
			E = i.o
		}
		return aI.hsl2rgb(i, e, d / 2, E)
	};
	aI.hsl2rgb = function (bH, bO, E, e) {
		if (aI.is(bH, "object") && "h" in bH && "s" in bH && "l" in bH) {
			E = bH.l;
			bO = bH.s;
			bH = bH.h
		}
		if (bH > 1 || bO > 1 || E > 1) {
			bH /= 360;
			bO /= 100;
			E /= 100
		}
		var bM = {},
			bJ = ["r", "g", "b"],
			bI, bL, S, d, bK, bN;
		if (!bO) {
			bM = {
				r: E,
				g: E,
				b: E
			}
		} else {
			if (E < 0.5) {
				bI = E * (1 + bO)
			} else {
				bI = E + bO - E * bO
			}
			bL = 2 * E - bI;
			for (var R = 0; R < 3; R++) {
				S = bH + 1 / 3 * -(R - 1);
				S < 0 && S++;
				S > 1 && S--;
				if (S * 6 < 1) {
					bM[bJ[R]] = bL + (bI - bL) * 6 * S
				} else {
					if (S * 2 < 1) {
						bM[bJ[R]] = bI
					} else {
						if (S * 3 < 2) {
							bM[bJ[R]] = bL + (bI - bL) * (2 / 3 - S) * 6
						} else {
							bM[bJ[R]] = bL
						}
					}
				}
			}
		}
		bM.r *= 255;
		bM.g *= 255;
		bM.b *= 255;
		bM.hex = "#" + (16777216 | bM.b | (bM.g << 8) | (bM.r << 16)).toString(16).slice(1);
		aI.is(e, "finite") && (bM.opacity = e);
		bM.toString = B;
		return bM
	};
	aI.rgb2hsb = function (b, d, bH) {
		if (d == null && aI.is(b, "object") && "r" in b && "g" in b && "b" in b) {
			bH = b.b;
			d = b.g;
			b = b.r
		}
		if (d == null && aI.is(b, af)) {
			var bJ = aI.getRGB(b);
			b = bJ.r;
			d = bJ.g;
			bH = bJ.b
		}
		if (b > 1 || d > 1 || bH > 1) {
			b /= 255;
			d /= 255;
			bH /= 255
		}
		var S = m(b, d, bH),
			e = bi(b, d, bH),
			E, i, R = S;
		if (e == S) {
			return {
				h: 0,
				s: 0,
				b: S,
				toString: aC
			}
		} else {
			var bI = (S - e);
			i = bI / S;
			if (b == S) {
				E = (d - bH) / bI
			} else {
				if (d == S) {
					E = 2 + ((bH - b) / bI)
				} else {
					E = 4 + ((b - d) / bI)
				}
			}
			E /= 6;
			E < 0 && E++;
			E > 1 && E--
		}
		return {
			h: E,
			s: i,
			b: R,
			toString: aC
		}
	};
	aI.rgb2hsl = function (d, e, S) {
		if (e == null && aI.is(d, "object") && "r" in d && "g" in d && "b" in d) {
			S = d.b;
			e = d.g;
			d = d.r
		}
		if (e == null && aI.is(d, af)) {
			var bK = aI.getRGB(d);
			d = bK.r;
			e = bK.g;
			S = bK.b
		}
		if (d > 1 || e > 1 || S > 1) {
			d /= 255;
			e /= 255;
			S /= 255
		}
		var R = m(d, e, S),
			i = bi(d, e, S),
			E, bJ, b = (R + i) / 2,
			bI;
		if (i == R) {
			bI = {
				h: 0,
				s: 0,
				l: b
			}
		} else {
			var bH = R - i;
			bJ = b < 0.5 ? bH / (R + i) : bH / (2 - R - i);
			if (d == R) {
				E = (e - S) / bH
			} else {
				if (e == R) {
					E = 2 + (S - d) / bH
				} else {
					E = 4 + (d - e) / bH
				}
			}
			E /= 6;
			E < 0 && E++;
			E > 1 && E--;
			bI = {
				h: E,
				s: bJ,
				l: b
			}
		}
		bI.toString = M;
		return bI
	};
	aI._path2string = function () {
		return this.join(",")[bs](ba, "$1")
	};

	function aA(i, d, b) {
		function e() {
			var E = Array[bE].slice.call(arguments, 0),
				S = E[aW]("\u25ba"),
				R = e.cache = e.cache || {},
				bH = e.count = e.count || [];
			if (R[ag](S)) {
				return b ? b(R[S]) : R[S]
			}
			bH[s] >= 1000 && delete R[bH.shift()];
			bH[k](S);
			R[S] = i[bB](d, E);
			return b ? b(R[S]) : R[S]
		}
		return e
	}
	aI.getRGB = aA(function (b) {
		if (!b || !!((b = bC(b)).indexOf("-") + 1)) {
			return {
				r: -1,
				g: -1,
				b: -1,
				hex: "none",
				error: 1
			}
		}
		if (b == "none") {
			return {
				r: -1,
				g: -1,
				b: -1,
				hex: "none"
			}
		}!(n[ag](b.toLowerCase().substring(0, 2)) || b.charAt() == "#") && (b = a9(b));
		var E, d, e, S, i, bI, bH, R = b.match(G);
		if (R) {
			if (R[2]) {
				S = T(R[2].substring(5), 16);
				e = T(R[2].substring(3, 5), 16);
				d = T(R[2].substring(1, 3), 16)
			}
			if (R[3]) {
				S = T((bI = R[3].charAt(3)) + bI, 16);
				e = T((bI = R[3].charAt(2)) + bI, 16);
				d = T((bI = R[3].charAt(1)) + bI, 16)
			}
			if (R[4]) {
				bH = R[4][I](bd);
				d = aj(bH[0]);
				bH[0].slice(-1) == "%" && (d *= 2.55);
				e = aj(bH[1]);
				bH[1].slice(-1) == "%" && (e *= 2.55);
				S = aj(bH[2]);
				bH[2].slice(-1) == "%" && (S *= 2.55);
				R[1].toLowerCase().slice(0, 4) == "rgba" && (i = aj(bH[3]));
				bH[3] && bH[3].slice(-1) == "%" && (i /= 100)
			}
			if (R[5]) {
				bH = R[5][I](bd);
				d = aj(bH[0]);
				bH[0].slice(-1) == "%" && (d *= 2.55);
				e = aj(bH[1]);
				bH[1].slice(-1) == "%" && (e *= 2.55);
				S = aj(bH[2]);
				bH[2].slice(-1) == "%" && (S *= 2.55);
				(bH[0].slice(-3) == "deg" || bH[0].slice(-1) == "\xb0") && (d /= 360);
				R[1].toLowerCase().slice(0, 4) == "hsba" && (i = aj(bH[3]));
				bH[3] && bH[3].slice(-1) == "%" && (i /= 100);
				return aI.hsb2rgb(d, e, S, i)
			}
			if (R[6]) {
				bH = R[6][I](bd);
				d = aj(bH[0]);
				bH[0].slice(-1) == "%" && (d *= 2.55);
				e = aj(bH[1]);
				bH[1].slice(-1) == "%" && (e *= 2.55);
				S = aj(bH[2]);
				bH[2].slice(-1) == "%" && (S *= 2.55);
				(bH[0].slice(-3) == "deg" || bH[0].slice(-1) == "\xb0") && (d /= 360);
				R[1].toLowerCase().slice(0, 4) == "hsla" && (i = aj(bH[3]));
				bH[3] && bH[3].slice(-1) == "%" && (i /= 100);
				return aI.hsl2rgb(d, e, S, i)
			}
			R = {
				r: d,
				g: e,
				b: S
			};
			R.hex = "#" + (16777216 | S | (e << 8) | (d << 16)).toString(16).slice(1);
			aI.is(i, "finite") && (R.opacity = i);
			return R
		}
		return {
			r: -1,
			g: -1,
			b: -1,
			hex: "none",
			error: 1
		}
	}, aI);
	aI.getColor = function (d) {
		var e = this.getColor.start = this.getColor.start || {
				h: 0,
				s: 1,
				b: d || 0.75
			},
			b = this.hsb2rgb(e.h, e.s, e.b);
		e.h += 0.075;
		if (e.h > 1) {
			e.h = 0;
			e.s -= 0.2;
			e.s <= 0 && (this.getColor.start = {
				h: 0,
				s: 1,
				b: e.b
			})
		}
		return b.hex
	};
	aI.getColor.reset = function () {
		delete this.start
	};
	aI.parsePathString = aA(function (b) {
		if (!b) {
			return null
		}
		var e = {
				a: 7,
				c: 6,
				h: 1,
				l: 2,
				m: 2,
				q: 4,
				s: 4,
				t: 2,
				v: 1,
				z: 0
			},
			d = [];
		if (aI.is(b, a7) && aI.is(b[0], a7)) {
			d = aS(b)
		}
		if (!d[s]) {
			bC(b)[bs](aR, function (E, i, bH) {
				var S = [],
					R = bG.call(i);
				bH[bs](aG, function (bJ, bI) {
					bI && S[k](+bI)
				});
				if (R == "m" && S[s] > 2) {
					d[k]([i][bw](S.splice(0, 2)));
					R = "l";
					i = i == "m" ? "l" : "L"
				}
				while (S[s] >= e[R]) {
					d[k]([i][bw](S.splice(0, e[R])));
					if (!e[R]) {
						break
					}
				}
			})
		}
		d[a0] = aI._path2string;
		return d
	});
	aI.findDotsAtSegment = function (d, b, bU, bS, S, E, bI, bH, bO) {
		var bM = 1 - bO,
			bL = bl(bM, 3) * d + bl(bM, 2) * 3 * bO * bU + bM * 3 * bO * bO * S + bl(bO, 3) * bI,
			bJ = bl(bM, 3) * b + bl(bM, 2) * 3 * bO * bS + bM * 3 * bO * bO * E + bl(bO, 3) * bH,
			bQ = d + 2 * bO * (bU - d) + bO * bO * (S - 2 * bU + d),
			bP = b + 2 * bO * (bS - b) + bO * bO * (E - 2 * bS + b),
			bT = bU + 2 * bO * (S - bU) + bO * bO * (bI - 2 * S + bU),
			bR = bS + 2 * bO * (E - bS) + bO * bO * (bH - 2 * E + bS),
			bN = (1 - bO) * d + bO * bU,
			bK = (1 - bO) * b + bO * bS,
			i = (1 - bO) * S + bO * bI,
			e = (1 - bO) * E + bO * bH,
			R = (90 - ao.atan((bQ - bT) / (bP - bR)) * 180 / aM);
		(bQ > bT || bP < bR) && (R += 180);
		return {
			x: bL,
			y: bJ,
			m: {
				x: bQ,
				y: bP
			},
			n: {
				x: bT,
				y: bR
			},
			start: {
				x: bN,
				y: bK
			},
			end: {
				x: i,
				y: e
			},
			alpha: R
		}
	};
	var ai = aA(function (bL) {
			if (!bL) {
				return {
					x: 0,
					y: 0,
					width: 0,
					height: 0
				}
			}
			bL = V(bL);
			var bI = 0,
				bH = 0,
				E = [],
				d = [],
				e;
			for (var R = 0, bK = bL[s]; R < bK; R++) {
				e = bL[R];
				if (e[0] == "M") {
					bI = e[1];
					bH = e[2];
					E[k](bI);
					d[k](bH)
				} else {
					var S = a6(bI, bH, e[1], e[2], e[3], e[4], e[5], e[6]);
					E = E[bw](S.min.x, S.max.x);
					d = d[bw](S.min.y, S.max.y);
					bI = e[5];
					bH = e[6]
				}
			}
			var b = bi[bB](0, E),
				bJ = bi[bB](0, d);
			return {
				x: b,
				y: bJ,
				width: m[bB](0, E) - b,
				height: m[bB](0, d) - bJ
			}
		}),
		aS = function (S) {
			var e = [];
			if (!aI.is(S, a7) || !aI.is(S && S[0], a7)) {
				S = aI.parsePathString(S)
			}
			for (var d = 0, E = S[s]; d < E; d++) {
				e[d] = [];
				for (var b = 0, R = S[d][s]; b < R; b++) {
					e[d][b] = S[d][b]
				}
			}
			e[a0] = aI._path2string;
			return e
		},
		au = aA(function (E) {
			if (!aI.is(E, a7) || !aI.is(E && E[0], a7)) {
				E = aI.parsePathString(E)
			}
			var bK = [],
				bM = 0,
				bL = 0,
				bP = 0,
				bO = 0,
				e = 0;
			if (E[0][0] == "M") {
				bM = E[0][1];
				bL = E[0][2];
				bP = bM;
				bO = bL;
				e++;
				bK[k](["M", bM, bL])
			}
			for (var bH = e, bQ = E[s]; bH < bQ; bH++) {
				var b = bK[bH] = [],
					bN = E[bH];
				if (bN[0] != bG.call(bN[0])) {
					b[0] = bG.call(bN[0]);
					switch (b[0]) {
						case "a":
							b[1] = bN[1];
							b[2] = bN[2];
							b[3] = bN[3];
							b[4] = bN[4];
							b[5] = bN[5];
							b[6] = +(bN[6] - bM).toFixed(3);
							b[7] = +(bN[7] - bL).toFixed(3);
							break;
						case "v":
							b[1] = +(bN[1] - bL).toFixed(3);
							break;
						case "m":
							bP = bN[1];
							bO = bN[2];
						default:
							for (var S = 1, bI = bN[s]; S < bI; S++) {
								b[S] = +(bN[S] - ((S % 2) ? bM : bL)).toFixed(3)
							}
					}
				} else {
					b = bK[bH] = [];
					if (bN[0] == "m") {
						bP = bN[1] + bM;
						bO = bN[2] + bL
					}
					for (var R = 0, d = bN[s]; R < d; R++) {
						bK[bH][R] = bN[R]
					}
				}
				var bJ = bK[bH][s];
				switch (bK[bH][0]) {
					case "z":
						bM = bP;
						bL = bO;
						break;
					case "h":
						bM += +bK[bH][bJ - 1];
						break;
					case "v":
						bL += +bK[bH][bJ - 1];
						break;
					default:
						bM += +bK[bH][bJ - 2];
						bL += +bK[bH][bJ - 1]
				}
			}
			bK[a0] = aI._path2string;
			return bK
		}, 0, aS),
		y = aA(function (E) {
			if (!aI.is(E, a7) || !aI.is(E && E[0], a7)) {
				E = aI.parsePathString(E)
			}
			var bJ = [],
				bL = 0,
				bK = 0,
				bO = 0,
				bN = 0,
				e = 0;
			if (E[0][0] == "M") {
				bL = +E[0][1];
				bK = +E[0][2];
				bO = bL;
				bN = bK;
				e++;
				bJ[0] = ["M", bL, bK]
			}
			for (var bH = e, bP = E[s]; bH < bP; bH++) {
				var b = bJ[bH] = [],
					bM = E[bH];
				if (bM[0] != bo.call(bM[0])) {
					b[0] = bo.call(bM[0]);
					switch (b[0]) {
						case "A":
							b[1] = bM[1];
							b[2] = bM[2];
							b[3] = bM[3];
							b[4] = bM[4];
							b[5] = bM[5];
							b[6] = +(bM[6] + bL);
							b[7] = +(bM[7] + bK);
							break;
						case "V":
							b[1] = +bM[1] + bK;
							break;
						case "H":
							b[1] = +bM[1] + bL;
							break;
						case "M":
							bO = +bM[1] + bL;
							bN = +bM[2] + bK;
						default:
							for (var S = 1, bI = bM[s]; S < bI; S++) {
								b[S] = +bM[S] + ((S % 2) ? bL : bK)
							}
					}
				} else {
					for (var R = 0, d = bM[s]; R < d; R++) {
						bJ[bH][R] = bM[R]
					}
				}
				switch (b[0]) {
					case "Z":
						bL = bO;
						bK = bN;
						break;
					case "H":
						bL = b[1];
						break;
					case "V":
						bK = b[1];
						break;
					case "M":
						bO = bJ[bH][bJ[bH][s] - 2];
						bN = bJ[bH][bJ[bH][s] - 1];
					default:
						bL = bJ[bH][bJ[bH][s] - 2];
						bK = bJ[bH][bJ[bH][s] - 1]
				}
			}
			bJ[a0] = aI._path2string;
			return bJ
		}, null, aS),
		bD = function (d, i, b, e) {
			return [d, i, b, e, b, e]
		},
		bj = function (d, i, S, E, b, e) {
			var R = 1 / 3,
				bH = 2 / 3;
			return [R * d + bH * S, R * i + bH * E, R * b + bH * S, R * e + bH * E, b, e]
		},
		Z = function (bO, cj, bX, bV, bP, bJ, E, bN, ci, bQ) {
			var bU = aM * 120 / 180,
				b = aM / 180 * (+bP || 0),
				b1 = [],
				bY, cf = aA(function (ck, cn, i) {
					var cm = ck * ao.cos(i) - cn * ao.sin(i),
						cl = ck * ao.sin(i) + cn * ao.cos(i);
					return {
						x: cm,
						y: cl
					}
				});
			if (!bQ) {
				bY = cf(bO, cj, -b);
				bO = bY.x;
				cj = bY.y;
				bY = cf(bN, ci, -b);
				bN = bY.x;
				ci = bY.y;
				var d = ao.cos(aM / 180 * bP),
					bL = ao.sin(aM / 180 * bP),
					b3 = (bO - bN) / 2,
					b2 = (cj - ci) / 2;
				var cd = (b3 * b3) / (bX * bX) + (b2 * b2) / (bV * bV);
				if (cd > 1) {
					cd = ao.sqrt(cd);
					bX = cd * bX;
					bV = cd * bV
				}
				var e = bX * bX,
					b6 = bV * bV,
					b8 = (bJ == E ? -1 : 1) * ao.sqrt(aq((e * b6 - e * b2 * b2 - b6 * b3 * b3) / (e * b2 * b2 + b6 * b3 * b3))),
					bS = b8 * bX * b2 / bV + (bO + bN) / 2,
					bR = b8 * -bV * b3 / bX + (cj + ci) / 2,
					bI = ao.asin(((cj - bR) / bV).toFixed(9)),
					bH = ao.asin(((ci - bR) / bV).toFixed(9));
				bI = bO < bS ? aM - bI : bI;
				bH = bN < bS ? aM - bH : bH;
				bI < 0 && (bI = aM * 2 + bI);
				bH < 0 && (bH = aM * 2 + bH);
				if (E && bI > bH) {
					bI = bI - aM * 2
				}
				if (!E && bH > bI) {
					bH = bH - aM * 2
				}
			} else {
				bI = bQ[0];
				bH = bQ[1];
				bS = bQ[2];
				bR = bQ[3]
			}
			var bM = bH - bI;
			if (aq(bM) > bU) {
				var bT = bH,
					bW = bN,
					bK = ci;
				bH = bI + bU * (E && bH > bI ? 1 : -1);
				bN = bS + bX * ao.cos(bH);
				ci = bR + bV * ao.sin(bH);
				b1 = Z(bN, ci, bX, bV, bP, 0, E, bW, bK, [bH, bT, bS, bR])
			}
			bM = bH - bI;
			var S = ao.cos(bI),
				ch = ao.sin(bI),
				R = ao.cos(bH),
				cg = ao.sin(bH),
				b4 = ao.tan(bM / 4),
				b7 = 4 / 3 * bX * b4,
				b5 = 4 / 3 * bV * b4,
				ce = [bO, cj],
				cc = [bO + b7 * ch, cj - b5 * S],
				cb = [bN + b7 * cg, ci - b5 * R],
				b9 = [bN, ci];
			cc[0] = 2 * ce[0] - cc[0];
			cc[1] = 2 * ce[1] - cc[1];
			if (bQ) {
				return [cc, cb, b9][bw](b1)
			} else {
				b1 = [cc, cb, b9][bw](b1)[aW]()[I](",");
				var bZ = [];
				for (var ca = 0, b0 = b1[s]; ca < b0; ca++) {
					bZ[ca] = ca % 2 ? cf(b1[ca - 1], b1[ca], b).y : cf(b1[ca], b1[ca + 1], b).x
				}
				return bZ
			}
		},
		ac = function (d, b, i, e, bI, bH, S, R, bJ) {
			var E = 1 - bJ;
			return {
				x: bl(E, 3) * d + bl(E, 2) * 3 * bJ * i + E * 3 * bJ * bJ * bI + bl(bJ, 3) * S,
				y: bl(E, 3) * b + bl(E, 2) * 3 * bJ * e + E * 3 * bJ * bJ * bH + bl(bJ, 3) * R
			}
		},
		a6 = aA(function (i, d, R, E, bQ, bP, bM, bJ) {
			var bO = (bQ - 2 * R + i) - (bM - 2 * bQ + R),
				bL = 2 * (R - i) - 2 * (bQ - R),
				bI = i - R,
				bH = (-bL + ao.sqrt(bL * bL - 4 * bO * bI)) / 2 / bO,
				S = (-bL - ao.sqrt(bL * bL - 4 * bO * bI)) / 2 / bO,
				bK = [d, bJ],
				bN = [i, bM],
				e;
			aq(bH) > "1e12" && (bH = 0.5);
			aq(S) > "1e12" && (S = 0.5);
			if (bH > 0 && bH < 1) {
				e = ac(i, d, R, E, bQ, bP, bM, bJ, bH);
				bN[k](e.x);
				bK[k](e.y)
			}
			if (S > 0 && S < 1) {
				e = ac(i, d, R, E, bQ, bP, bM, bJ, S);
				bN[k](e.x);
				bK[k](e.y)
			}
			bO = (bP - 2 * E + d) - (bJ - 2 * bP + E);
			bL = 2 * (E - d) - 2 * (bP - E);
			bI = d - E;
			bH = (-bL + ao.sqrt(bL * bL - 4 * bO * bI)) / 2 / bO;
			S = (-bL - ao.sqrt(bL * bL - 4 * bO * bI)) / 2 / bO;
			aq(bH) > "1e12" && (bH = 0.5);
			aq(S) > "1e12" && (S = 0.5);
			if (bH > 0 && bH < 1) {
				e = ac(i, d, R, E, bQ, bP, bM, bJ, bH);
				bN[k](e.x);
				bK[k](e.y)
			}
			if (S > 0 && S < 1) {
				e = ac(i, d, R, E, bQ, bP, bM, bJ, S);
				bN[k](e.x);
				bK[k](e.y)
			}
			return {
				min: {
					x: bi[bB](0, bN),
					y: bi[bB](0, bK)
				},
				max: {
					x: m[bB](0, bN),
					y: m[bB](0, bK)
				}
			}
		}),
		V = aA(function (bP, bK) {
			var E = y(bP),
				bL = bK && y(bK),
				bM = {
					x: 0,
					y: 0,
					bx: 0,
					by: 0,
					X: 0,
					Y: 0,
					qx: null,
					qy: null
				},
				b = {
					x: 0,
					y: 0,
					bx: 0,
					by: 0,
					X: 0,
					Y: 0,
					qx: null,
					qy: null
				},
				S = function (bQ, bR) {
					var i, bS;
					if (!bQ) {
						return ["C", bR.x, bR.y, bR.x, bR.y, bR.x, bR.y]
					}!(bQ[0] in {
						T: 1,
						Q: 1
					}) && (bR.qx = bR.qy = null);
					switch (bQ[0]) {
						case "M":
							bR.X = bQ[1];
							bR.Y = bQ[2];
							break;
						case "A":
							bQ = ["C"][bw](Z[bB](0, [bR.x, bR.y][bw](bQ.slice(1))));
							break;
						case "S":
							i = bR.x + (bR.x - (bR.bx || bR.x));
							bS = bR.y + (bR.y - (bR.by || bR.y));
							bQ = ["C", i, bS][bw](bQ.slice(1));
							break;
						case "T":
							bR.qx = bR.x + (bR.x - (bR.qx || bR.x));
							bR.qy = bR.y + (bR.y - (bR.qy || bR.y));
							bQ = ["C"][bw](bj(bR.x, bR.y, bR.qx, bR.qy, bQ[1], bQ[2]));
							break;
						case "Q":
							bR.qx = bQ[1];
							bR.qy = bQ[2];
							bQ = ["C"][bw](bj(bR.x, bR.y, bQ[1], bQ[2], bQ[3], bQ[4]));
							break;
						case "L":
							bQ = ["C"][bw](bD(bR.x, bR.y, bQ[1], bQ[2]));
							break;
						case "H":
							bQ = ["C"][bw](bD(bR.x, bR.y, bQ[1], bR.y));
							break;
						case "V":
							bQ = ["C"][bw](bD(bR.x, bR.y, bR.x, bQ[1]));
							break;
						case "Z":
							bQ = ["C"][bw](bD(bR.x, bR.y, bR.X, bR.Y));
							break
					}
					return bQ
				},
				d = function (bQ, bR) {
					if (bQ[bR][s] > 7) {
						bQ[bR].shift();
						var bS = bQ[bR];
						while (bS[s]) {
							bQ.splice(bR++, 0, ["C"][bw](bS.splice(0, 6)))
						}
						bQ.splice(bR, 1);
						bN = m(E[s], bL && bL[s] || 0)
					}
				},
				e = function (bU, bT, bR, bQ, bS) {
					if (bU && bT && bU[bS][0] == "M" && bT[bS][0] != "M") {
						bT.splice(bS, 0, ["M", bQ.x, bQ.y]);
						bR.bx = 0;
						bR.by = 0;
						bR.x = bU[bS][1];
						bR.y = bU[bS][2];
						bN = m(E[s], bL && bL[s] || 0)
					}
				};
			for (var bI = 0, bN = m(E[s], bL && bL[s] || 0); bI < bN; bI++) {
				E[bI] = S(E[bI], bM);
				d(E, bI);
				bL && (bL[bI] = S(bL[bI], b));
				bL && d(bL, bI);
				e(E, bL, bM, b, bI);
				e(bL, E, b, bM, bI);
				var bH = E[bI],
					bO = bL && bL[bI],
					R = bH[s],
					bJ = bL && bO[s];
				bM.x = bH[R - 2];
				bM.y = bH[R - 1];
				bM.bx = aj(bH[R - 4]) || bM.x;
				bM.by = aj(bH[R - 3]) || bM.y;
				b.bx = bL && (aj(bO[bJ - 4]) || b.x);
				b.by = bL && (aj(bO[bJ - 3]) || b.y);
				b.x = bL && bO[bJ - 2];
				b.y = bL && bO[bJ - 1]
			}
			return bL ? [E, bL] : E
		}, null, aS),
		w = aA(function (bK) {
			var bJ = [];
			for (var S = 0, bL = bK[s]; S < bL; S++) {
				var b = {},
					bI = bK[S].match(/^([^:]*):?([\d\.]*)/);
				b.color = aI.getRGB(bI[1]);
				if (b.color.error) {
					return null
				}
				b.color = b.color.hex;
				bI[2] && (b.offset = bI[2] + "%");
				bJ[k](b)
			}
			for (S = 1, bL = bJ[s] - 1; S < bL; S++) {
				if (!bJ[S].offset) {
					var e = aj(bJ[S - 1].offset || 0),
						E = 0;
					for (var R = S + 1; R < bL; R++) {
						if (bJ[R].offset) {
							E = bJ[R].offset;
							break
						}
					}
					if (!E) {
						E = 100;
						R = bL
					}
					E = aj(E);
					var bH = (E - e) / (R - S + 1);
					for (; S < R; S++) {
						e += bH;
						bJ[S].offset = e + "%"
					}
				}
			}
			return bJ
		}),
		aJ = function (b, S, e, i, R, E) {
			var d;
			if (aI.is(b, af) || aI.is(b, "object")) {
				d = aI.is(b, af) ? aa.getElementById(b) : b;
				if (d.tagName) {
					if (S == null) {
						return {
							container: d,
							width: d.style.pixelWidth || d.offsetWidth,
							height: d.style.pixelHeight || d.offsetHeight
						}
					} else {
						return {
							container: d,
							width: S,
							height: e,
							viewBox: i,
							vmlSize: R
						}
					}
				}
			} else {
				return {
					container: 1,
					x: b,
					y: S,
					width: e,
					height: i,
					viewBox: R,
					vmlSize: E
				}
			}
		},
		be = function (b, e) {
			var d = this;
			for (var i in e) {
				if (e[ag](i) && !(i in b)) {
					switch (typeof e[i]) {
						case "function":
							(function (E) {
								b[i] = b === d ? E : function () {
									return E[bB](d, arguments)
								}
							})(e[i]);
							break;
						case "object":
							b[i] = b[i] || {};
							be.call(this, b[i], e[i]);
							break;
						default:
							b[i] = e[i];
							break
					}
				}
			}
		},
		aE = function (b, d) {
			b == d.top && (d.top = b.prev);
			b == d.bottom && (d.bottom = b.next);
			b.next && (b.next.prev = b.prev);
			b.prev && (b.prev.next = b.next)
		},
		al = function (b, d) {
			if (d.top === b) {
				return
			}
			aE(b, d);
			b.next = null;
			b.prev = d.top;
			d.top.next = b;
			d.top = b
		},
		p = function (b, d) {
			if (d.bottom === b) {
				return
			}
			aE(b, d);
			b.next = d.bottom;
			b.prev = null;
			d.bottom.prev = b;
			d.bottom = b
		},
		J = function (d, b, e) {
			aE(d, e);
			b == e.top && (e.top = d);
			b.next && (b.next.prev = d);
			d.next = b.next;
			d.prev = b;
			b.next = d
		},
		aL = function (d, b, e) {
			aE(d, e);
			b == e.bottom && (e.bottom = d);
			b.prev && (b.prev.next = d);
			d.prev = b.prev;
			b.prev = d;
			d.next = b
		},
		z = function (b) {
			return function () {
				throw new Error("Rapha\xebl: you are calling to method \u201c" + b + "\u201d of removed object")
			}
		};
	aI.pathToRelative = au;
	if (aI.svg) {
		aZ.svgns = "http://www.w3.org/2000/svg";
		aZ.xlink = "http://www.w3.org/1999/xlink";
		ad = function (b) {
			return +b + (~~b === b) * 0.5
		};
		var bh = function (e, b) {
			if (b) {
				for (var d in b) {
					if (b[ag](d)) {
						e[D](d, bC(b[d]))
					}
				}
			} else {
				e = aa.createElementNS(aZ.svgns, e);
				e.style.webkitTapHighlightColor = "rgba(0,0,0,0)";
				return e
			}
		};
		aI[a0] = function () {
			return "Your browser supports SVG.\nYou are running Rapha\xebl " + this.version
		};
		var x = function (b, i) {
			var d = bh("path");
			i.canvas && i.canvas[bk](d);
			var e = new aU(d, i);
			e.type = "path";
			an(e, {
				fill: "none",
				stroke: "#000",
				path: b
			});
			return e
		};
		var g = function (E, bO, b) {
			var bL = "linear",
				bI = 0.5,
				S = 0.5,
				bQ = E.style;
			bO = bC(bO)[bs](aO, function (bS, i, bT) {
				bL = "radial";
				if (i && bT) {
					bI = aj(i);
					S = aj(bT);
					var bR = ((S > 0.5) * 2 - 1);
					bl(bI - 0.5, 2) + bl(S - 0.5, 2) > 0.25 && (S = ao.sqrt(0.25 - bl(bI - 0.5, 2)) * bR + 0.5) && S != 0.5 && (S = S.toFixed(5) - 0.00001 * bR)
				}
				return aP
			});
			bO = bO[I](/\s*\-\s*/);
			if (bL == "linear") {
				var bH = bO.shift();
				bH = -aj(bH);
				if (isNaN(bH)) {
					return null
				}
				var R = [0, 0, ao.cos(bH * aM / 180), ao.sin(bH * aM / 180)],
					bN = 1 / (m(aq(R[2]), aq(R[3])) || 1);
				R[2] *= bN;
				R[3] *= bN;
				if (R[2] < 0) {
					R[0] = -R[2];
					R[2] = 0
				}
				if (R[3] < 0) {
					R[1] = -R[3];
					R[3] = 0
				}
			}
			var bK = w(bO);
			if (!bK) {
				return null
			}
			var d = E.getAttribute(a4);
			d = d.match(/^url\(#(.*)\)$/);
			d && b.defs.removeChild(aa.getElementById(d[1]));
			var e = bh(bL + "Gradient");
			e.id = j();
			bh(e, bL == "radial" ? {
				fx: bI,
				fy: S
			} : {
				x1: R[0],
				y1: R[1],
				x2: R[2],
				y2: R[3]
			});
			b.defs[bk](e);
			for (var bJ = 0, bP = bK[s]; bJ < bP; bJ++) {
				var bM = bh("stop");
				bh(bM, {
					offset: bK[bJ].offset ? bK[bJ].offset : !bJ ? "0%" : "100%",
					"stop-color": bK[bJ].color || "#fff"
				});
				e[bk](bM)
			}
			bh(E, {
				fill: "url(#" + e.id + ")",
				opacity: 1,
				"fill-opacity": 1
			});
			bQ.fill = aP;
			bQ.opacity = 1;
			bQ.fillOpacity = 1;
			return 1
		};
		var ab = function (d) {
			var b = d.getBBox();
			bh(d.pattern, {
				patternTransform: aI.format("translate({0},{1})", b.x, b.y)
			})
		};
		var an = function (bN, bW) {
			var bQ = {
					"": [0],
					none: [0],
					"-": [3, 1],
					".": [1, 1],
					"-.": [3, 1, 1, 1],
					"-..": [3, 1, 1, 1, 1, 1],
					". ": [1, 3],
					"- ": [4, 3],
					"--": [8, 3],
					"- .": [4, 3, 1, 3],
					"--.": [8, 3, 1, 3],
					"--..": [8, 3, 1, 3, 1, 3]
				},
				bS = bN.node,
				bO = bN.attrs,
				bK = bN.rotate(),
				S = function (b3, b2) {
					b2 = bQ[bG.call(b2)];
					if (b2) {
						var b0 = b3.attrs["stroke-width"] || "1",
							bY = {
								round: b0,
								square: b0,
								butt: 0
							} [b3.attrs["stroke-linecap"] || bW["stroke-linecap"]] || 0,
							b1 = [];
						var bZ = b2[s];
						while (bZ--) {
							b1[bZ] = b2[bZ] * b0 + ((bZ % 2) ? 1 : -1) * bY
						}
						bh(bS, {
							"stroke-dasharray": b1[aW](",")
						})
					}
				};
			bW[ag]("rotation") && (bK = bW.rotation);
			var bJ = bC(bK)[I](a);
			if (!(bJ.length - 1)) {
				bJ = null
			} else {
				bJ[1] = +bJ[1];
				bJ[2] = +bJ[2]
			}
			aj(bK) && bN.rotate(0, true);
			for (var bR in bW) {
				if (bW[ag](bR)) {
					if (!q[ag](bR)) {
						continue
					}
					var bP = bW[bR];
					bO[bR] = bP;
					switch (bR) {
						case "blur":
							bN.blur(bP);
							break;
						case "rotation":
							bN.rotate(bP, true);
							break;
						case "href":
						case "title":
						case "target":
							var bU = bS.parentNode;
							if (bG.call(bU.tagName) != "a") {
								var E = bh("a");
								bU.insertBefore(E, bS);
								E[bk](bS);
								bU = E
							}
							if (bR == "target" && bP == "blank") {
								bU.setAttributeNS(bN.paper.xlink, "show", "new")
							} else {
								bU.setAttributeNS(bN.paper.xlink, bR, bP)
							}
							break;
						case "cursor":
							bS.style.cursor = bP;
							break;
						case "clip-rect":
							var d = bC(bP)[I](a);
							if (d[s] == 4) {
								bN.clip && bN.clip.parentNode.parentNode.removeChild(bN.clip.parentNode);
								var e = bh("clipPath"),
									bT = bh("rect");
								e.id = j();
								bh(bT, {
									x: d[0],
									y: d[1],
									width: d[2],
									height: d[3]
								});
								e[bk](bT);
								bN.paper.defs[bk](e);
								bh(bS, {
									"clip-path": "url(#" + e.id + ")"
								});
								bN.clip = bT
							}
							if (!bP) {
								var bV = aa.getElementById(bS.getAttribute("clip-path")[bs](/(^url\(#|\)$)/g, aP));
								bV && bV.parentNode.removeChild(bV);
								bh(bS, {
									"clip-path": aP
								});
								delete bN.clip
							}
							break;
						case "path":
							if (bN.type == "path") {
								bh(bS, {
									d: bP ? bO.path = y(bP) : "M0,0"
								})
							}
							break;
						case "width":
							bS[D](bR, bP);
							if (bO.fx) {
								bR = "x";
								bP = bO.x
							} else {
								break
							}
						case "x":
							if (bO.fx) {
								bP = -bO.x - (bO.width || 0)
							}
						case "rx":
							if (bR == "rx" && bN.type == "rect") {
								break
							}
						case "cx":
							bJ && (bR == "x" || bR == "cx") && (bJ[1] += bP - bO[bR]);
							bS[D](bR, bP);
							bN.pattern && ab(bN);
							break;
						case "height":
							bS[D](bR, bP);
							if (bO.fy) {
								bR = "y";
								bP = bO.y
							} else {
								break
							}
						case "y":
							if (bO.fy) {
								bP = -bO.y - (bO.height || 0)
							}
						case "ry":
							if (bR == "ry" && bN.type == "rect") {
								break
							}
						case "cy":
							bJ && (bR == "y" || bR == "cy") && (bJ[2] += bP - bO[bR]);
							bS[D](bR, bP);
							bN.pattern && ab(bN);
							break;
						case "r":
							if (bN.type == "rect") {
								bh(bS, {
									rx: bP,
									ry: bP
								})
							} else {
								bS[D](bR, bP)
							}
							break;
						case "src":
							if (bN.type == "image") {
								bS.setAttributeNS(bN.paper.xlink, "href", bP)
							}
							break;
						case "stroke-width":
							bS.style.strokeWidth = bP;
							bS[D](bR, bP);
							if (bO["stroke-dasharray"]) {
								S(bN, bO["stroke-dasharray"])
							}
							break;
						case "stroke-dasharray":
							S(bN, bP);
							break;
						case "translation":
							var bH = bC(bP)[I](a);
							bH[0] = +bH[0] || 0;
							bH[1] = +bH[1] || 0;
							if (bJ) {
								bJ[1] += bH[0];
								bJ[2] += bH[1]
							}
							A.call(bN, bH[0], bH[1]);
							break;
						case "scale":
							bH = bC(bP)[I](a);
							bN.scale(+bH[0] || 1, +bH[1] || +bH[0] || 1, isNaN(aj(bH[2])) ? null : +bH[2], isNaN(aj(bH[3])) ? null : +bH[3]);
							break;
						case a4:
							var R = bC(bP).match(h);
							if (R) {
								e = bh("pattern");
								var bM = bh("image");
								e.id = j();
								bh(e, {
									x: 0,
									y: 0,
									patternUnits: "userSpaceOnUse",
									height: 1,
									width: 1
								});
								bh(bM, {
									x: 0,
									y: 0
								});
								bM.setAttributeNS(bN.paper.xlink, "href", R[1]);
								e[bk](bM);
								var bX = aa.createElement("img");
								bX.style.cssText = "position:absolute;left:-9999em;top-9999em";
								bX.onload = function () {
									bh(e, {
										width: this.offsetWidth,
										height: this.offsetHeight
									});
									bh(bM, {
										width: this.offsetWidth,
										height: this.offsetHeight
									});
									aa.body.removeChild(this);
									bN.paper.safari()
								};
								aa.body[bk](bX);
								bX.src = R[1];
								bN.paper.defs[bk](e);
								bS.style.fill = "url(#" + e.id + ")";
								bh(bS, {
									fill: "url(#" + e.id + ")"
								});
								bN.pattern = e;
								bN.pattern && ab(bN);
								break
							}
							var i = aI.getRGB(bP);
							if (!i.error) {
								delete bW.gradient;
								delete bO.gradient;
								!aI.is(bO.opacity, "undefined") && aI.is(bW.opacity, "undefined") && bh(bS, {
									opacity: bO.opacity
								});
								!aI.is(bO["fill-opacity"], "undefined") && aI.is(bW["fill-opacity"], "undefined") && bh(bS, {
									"fill-opacity": bO["fill-opacity"]
								})
							} else {
								if ((({
										circle: 1,
										ellipse: 1
									})[ag](bN.type) || bC(bP).charAt() != "r") && g(bS, bP, bN.paper)) {
									bO.gradient = bP;
									bO.fill = "none";
									break
								}
							}
							i[ag]("opacity") && bh(bS, {
								"fill-opacity": i.opacity > 1 ? i.opacity / 100 : i.opacity
							});
						case "stroke":
							i = aI.getRGB(bP);
							bS[D](bR, i.hex);
							bR == "stroke" && i[ag]("opacity") && bh(bS, {
								"stroke-opacity": i.opacity > 1 ? i.opacity / 100 : i.opacity
							});
							break;
						case "gradient":
							(({
								circle: 1,
								ellipse: 1
							})[ag](bN.type) || bC(bP).charAt() != "r") && g(bS, bP, bN.paper);
							break;
						case "opacity":
							if (bO.gradient && !bO[ag]("stroke-opacity")) {
								bh(bS, {
									"stroke-opacity": bP > 1 ? bP / 100 : bP
								})
							}
						case "fill-opacity":
							if (bO.gradient) {
								var b = aa.getElementById(bS.getAttribute(a4)[bs](/^url\(#|\)$/g, aP));
								if (b) {
									var bI = b.getElementsByTagName("stop");
									bI[bI[s] - 1][D]("stop-opacity", bP)
								}
								break
							}
						default:
							bR == "font-size" && (bP = T(bP, 10) + "px");
							var bL = bR[bs](/(\-.)/g, function (bY) {
								return bo.call(bY.substring(1))
							});
							bS.style[bL] = bP;
							bS[D](bR, bP);
							break
					}
				}
			}
			P(bN, bW);
			if (bJ) {
				bN.rotate(bJ.join(aH))
			} else {
				aj(bK) && bN.rotate(bK, true)
			}
		};
		var o = 1.2,
			P = function (b, E) {
				if (b.type != "text" || !(E[ag]("text") || E[ag]("font") || E[ag]("font-size") || E[ag]("x") || E[ag]("y"))) {
					return
				}
				var bJ = b.attrs,
					d = b.node,
					bL = d.firstChild ? T(aa.defaultView.getComputedStyle(d.firstChild, aP).getPropertyValue("font-size"), 10) : 10;
				if (E[ag]("text")) {
					bJ.text = E.text;
					while (d.firstChild) {
						d.removeChild(d.firstChild)
					}
					var e = bC(E.text)[I]("\n");
					for (var R = 0, bK = e[s]; R < bK; R++) {
						if (e[R]) {
							var bH = bh("tspan");
							R && bh(bH, {
								dy: bL * o,
								x: bJ.x
							});
							bH[bk](aa.createTextNode(e[R]));
							d[bk](bH)
						}
					}
				} else {
					e = d.getElementsByTagName("tspan");
					for (R = 0, bK = e[s]; R < bK; R++) {
						R && bh(e[R], {
							dy: bL * o,
							x: bJ.x
						})
					}
				}
				bh(d, {
					y: bJ.y
				});
				var S = b.getBBox(),
					bI = bJ.y - (S.y + S.height / 2);
				bI && aI.is(bI, "finite") && bh(d, {
					y: bJ.y + bI
				})
			},
			aU = function (d, b) {
				var i = 0,
					e = 0;
				this[0] = d;
				this.id = aI._oid++;
				this.node = d;
				d.raphael = this;
				this.paper = b;
				this.attrs = this.attrs || {};
				this.transformations = [];
				this._ = {
					tx: 0,
					ty: 0,
					rt: {
						deg: 0,
						cx: 0,
						cy: 0
					},
					sx: 1,
					sy: 1
				};
				!b.bottom && (b.bottom = this);
				this.prev = b.top;
				b.top && (b.top.next = this);
				b.top = this;
				this.next = null
			};
		var bc = aU[bE];
		aU[bE].rotate = function (d, b, i) {
			if (this.removed) {
				return this
			}
			if (d == null) {
				if (this._.rt.cx) {
					return [this._.rt.deg, this._.rt.cx, this._.rt.cy][aW](aH)
				}
				return this._.rt.deg
			}
			var e = this.getBBox();
			d = bC(d)[I](a);
			if (d[s] - 1) {
				b = aj(d[1]);
				i = aj(d[2])
			}
			d = aj(d[0]);
			if (b != null && b !== false) {
				this._.rt.deg = d
			} else {
				this._.rt.deg += d
			}(i == null) && (b = null);
			this._.rt.cx = b;
			this._.rt.cy = i;
			b = b == null ? e.x + e.width / 2 : b;
			i = i == null ? e.y + e.height / 2 : i;
			if (this._.rt.deg) {
				this.transformations[0] = aI.format("rotate({0} {1} {2})", this._.rt.deg, b, i);
				this.clip && bh(this.clip, {
					transform: aI.format("rotate({0} {1} {2})", -this._.rt.deg, b, i)
				})
			} else {
				this.transformations[0] = aP;
				this.clip && bh(this.clip, {
					transform: aP
				})
			}
			bh(this.node, {
				transform: this.transformations[aW](aH)
			});
			return this
		};
		aU[bE].hide = function () {
			!this.removed && (this.node.style.display = "none");
			return this
		};
		aU[bE].show = function () {
			!this.removed && (this.node.style.display = "");
			return this
		};
		aU[bE].remove = function () {
			if (this.removed) {
				return
			}
			aE(this, this.paper);
			this.node.parentNode.removeChild(this.node);
			for (var b in this) {
				delete this[b]
			}
			this.removed = true
		};
		aU[bE].getBBox = function () {
			if (this.removed) {
				return this
			}
			if (this.type == "path") {
				return ai(this.attrs.path)
			}
			if (this.node.style.display == "none") {
				this.show();
				var d = true
			}
			var bH = {};
			try {
				bH = this.node.getBBox()
			} catch (R) {} finally {
				bH = bH || {}
			}
			if (this.type == "text") {
				bH = {
					x: bH.x,
					y: Infinity,
					width: 0,
					height: 0
				};
				for (var b = 0, E = this.node.getNumberOfChars(); b < E; b++) {
					var S = this.node.getExtentOfChar(b);
					(S.y < bH.y) && (bH.y = S.y);
					(S.y + S.height - bH.y > bH.height) && (bH.height = S.y + S.height - bH.y);
					(S.x + S.width - bH.x > bH.width) && (bH.width = S.x + S.width - bH.x)
				}
			}
			d && this.hide();
			return bH
		};
		aU[bE].attr = function (b, bJ) {
			if (this.removed) {
				return this
			}
			if (b == null) {
				var bI = {};
				for (var R in this.attrs) {
					if (this.attrs[ag](R)) {
						bI[R] = this.attrs[R]
					}
				}
				this._.rt.deg && (bI.rotation = this.rotate());
				(this._.sx != 1 || this._.sy != 1) && (bI.scale = this.scale());
				bI.gradient && bI.fill == "none" && (bI.fill = bI.gradient) && delete bI.gradient;
				return bI
			}
			if (bJ == null && aI.is(b, af)) {
				if (b == "translation") {
					return A.call(this)
				}
				if (b == "rotation") {
					return this.rotate()
				}
				if (b == "scale") {
					return this.scale()
				}
				if (b == a4 && this.attrs.fill == "none" && this.attrs.gradient) {
					return this.attrs.gradient
				}
				return this.attrs[b]
			}
			if (bJ == null && aI.is(b, a7)) {
				var bL = {};
				for (var E = 0, S = b.length; E < S; E++) {
					bL[b[E]] = this.attr(b[E])
				}
				return bL
			}
			if (bJ != null) {
				var d = {};
				d[b] = bJ
			} else {
				if (b != null && aI.is(b, "object")) {
					d = b
				}
			}
			for (var bK in this.paper.customAttributes) {
				if (this.paper.customAttributes[ag](bK) && d[ag](bK) && aI.is(this.paper.customAttributes[bK], "function")) {
					var bH = this.paper.customAttributes[bK].apply(this, [][bw](d[bK]));
					this.attrs[bK] = d[bK];
					for (var e in bH) {
						if (bH[ag](e)) {
							d[e] = bH[e]
						}
					}
				}
			}
			an(this, d);
			return this
		};
		aU[bE].toFront = function () {
			if (this.removed) {
				return this
			}
			this.node.parentNode[bk](this.node);
			var b = this.paper;
			b.top != this && al(this, b);
			return this
		};
		aU[bE].toBack = function () {
			if (this.removed) {
				return this
			}
			if (this.node.parentNode.firstChild != this.node) {
				this.node.parentNode.insertBefore(this.node, this.node.parentNode.firstChild);
				p(this, this.paper);
				var b = this.paper
			}
			return this
		};
		aU[bE].insertAfter = function (b) {
			if (this.removed) {
				return this
			}
			var d = b.node || b[b.length - 1].node;
			if (d.nextSibling) {
				d.parentNode.insertBefore(this.node, d.nextSibling)
			} else {
				d.parentNode[bk](this.node)
			}
			J(this, b, this.paper);
			return this
		};
		aU[bE].insertBefore = function (b) {
			if (this.removed) {
				return this
			}
			var d = b.node || b[0].node;
			d.parentNode.insertBefore(this.node, d);
			aL(this, b, this.paper);
			return this
		};
		aU[bE].blur = function (d) {
			var b = this;
			if (+d !== 0) {
				var e = bh("filter"),
					i = bh("feGaussianBlur");
				b.attrs.blur = d;
				e.id = j();
				bh(i, {
					stdDeviation: +d || 1.5
				});
				e.appendChild(i);
				b.paper.defs.appendChild(e);
				b._blur = e;
				bh(b.node, {
					filter: "url(#" + e.id + ")"
				})
			} else {
				if (b._blur) {
					b._blur.parentNode.removeChild(b._blur);
					delete b._blur;
					delete b.attrs.blur
				}
				b.node.removeAttribute("filter")
			}
		};
		var ae = function (d, b, R, E) {
				var i = bh("circle");
				d.canvas && d.canvas[bk](i);
				var e = new aU(i, d);
				e.attrs = {
					cx: b,
					cy: R,
					r: E,
					fill: "none",
					stroke: "#000"
				};
				e.type = "circle";
				bh(i, e.attrs);
				return e
			},
			bb = function (e, b, bH, d, R, S) {
				var E = bh("rect");
				e.canvas && e.canvas[bk](E);
				var i = new aU(E, e);
				i.attrs = {
					x: b,
					y: bH,
					width: d,
					height: R,
					r: S || 0,
					rx: S || 0,
					ry: S || 0,
					fill: "none",
					stroke: "#000"
				};
				i.type = "rect";
				bh(E, i.attrs);
				return i
			},
			az = function (d, b, S, R, E) {
				var i = bh("ellipse");
				d.canvas && d.canvas[bk](i);
				var e = new aU(i, d);
				e.attrs = {
					cx: b,
					cy: S,
					rx: R,
					ry: E,
					fill: "none",
					stroke: "#000"
				};
				e.type = "ellipse";
				bh(i, e.attrs);
				return e
			},
			v = function (e, S, b, bH, d, R) {
				var E = bh("image");
				bh(E, {
					x: b,
					y: bH,
					width: d,
					height: R,
					preserveAspectRatio: "none"
				});
				E.setAttributeNS(e.xlink, "href", S);
				e.canvas && e.canvas[bk](E);
				var i = new aU(E, e);
				i.attrs = {
					x: b,
					y: bH,
					width: d,
					height: R,
					src: S
				};
				i.type = "image";
				return i
			},
			ak = function (d, b, R, E) {
				var i = bh("text");
				bh(i, {
					x: b,
					y: R,
					"text-anchor": "middle"
				});
				d.canvas && d.canvas[bk](i);
				var e = new aU(i, d);
				e.attrs = {
					x: b,
					y: R,
					"text-anchor": "middle",
					text: E,
					font: q.font,
					stroke: "none",
					fill: "#000"
				};
				e.type = "text";
				an(e, e.attrs);
				return e
			},
			bA = function (d, b) {
				this.width = d || this.width;
				this.height = b || this.height;
				this.canvas[D]("width", this.width);
				this.canvas[D]("height", this.height);
				return this
			},
			F = function () {
				var i = aJ[bB](0, arguments),
					e = i && i.container,
					d = i.x,
					bH = i.y,
					E = i.width,
					b = i.height,
					R = i.viewBox !== undefined ? i.viewBox : "";
				this.cordOrigin = i.cordOrigin;
				this.cordSize = i.cordSize;
				if (!e) {
					throw new Error("SVG container not found.")
				}
				var S = bh("svg");
				d = d || 0;
				bH = bH || 0;
				E = E || 512;
				b = b || 342;
				bh(S, {
					xmlns: "http://www.w3.org/2000/svg",
					version: 1.1,
					width: E,
					height: b,
					viewBox: R
				});
				if (e == 1) {
					S.style.cssText = "position:absolute;left:" + d + "px;top:" + bH + "px";
					aa.body[bk](S)
				} else {
					if (e.firstChild) {
						e.insertBefore(S, e.firstChild)
					} else {
						e[bk](S)
					}
				}
				e = new bz;
				e.width = E;
				e.height = b;
				e.canvas = S;
				be.call(e, e, aI.fn);
				e.clear();
				return e
			};
		aZ.clear = function () {
			var b = this.canvas;
			while (b.firstChild) {
				b.removeChild(b.firstChild)
			}
			this.bottom = this.top = null;
			(this.desc = bh("desc"))[bk](aa.createTextNode("Russian Map"));
			b[bk](this.desc);
			b[bk](this.defs = bh("defs"))
		};
		aZ.remove = function () {
			this.canvas.parentNode && this.canvas.parentNode.removeChild(this.canvas);
			for (var b in this) {
				this[b] = z(b)
			}
		}
	}
	if (aI.vml) {
		var N = {
				M: "m",
				L: "l",
				C: "c",
				Z: "x",
				m: "t",
				l: "r",
				c: "v",
				z: "x"
			},
			aN = /([clmz]),?([^clmz]*)/gi,
			bx = / progid:\S+Blur\([^\)]+\)/g,
			bF = /-?[^,\s-]+/g,
			aX = 1000 + aH + 1000,
			u = 0.5,
			t = {
				path: 1,
				rect: 1
			},
			bg = function (bL) {
				var bI = /[ahqstv]/ig,
					e = y;
				bC(bL).match(bI) && (e = V);
				bI = /[clmz]/g;
				if (e == y && !bC(bL).match(bI)) {
					var bH = bC(bL)[bs](aN, function (bO, bQ, bM) {
						var bP = [],
							i = bG.call(bQ) == "m",
							bN = N[bQ];
						bM[bs](bF, function (bR) {
							if (i && bP[s] == 2) {
								bN += bP + N[bQ == "m" ? "l" : "L"];
								bP = []
							}
							bP[k](ad(bR * u))
						});
						return bN + bP
					});
					return bH
				}
				var bJ = e(bL),
					d, b;
				bH = [];
				for (var R = 0, bK = bJ[s]; R < bK; R++) {
					d = bJ[R];
					b = bG.call(bJ[R][0]);
					b == "z" && (b = "x");
					for (var E = 1, S = d[s]; E < S; E++) {
						b += ad(d[E] * u) + (E != S - 1 ? "," : aP)
					}
					bH[k](b)
				}
				return bH[aW](aH)
			};
		aI[a0] = function () {
			return "Your browser doesn\u2019t support SVG. Falling down to VML.\nYou are running Rapha\xebl " + this.version
		};
		x = function (e, d) {
			var R = ay("group");
			R.style.cssText = "position:absolute;left:0;top:0;width:" + d.width + "px;height:" + d.height + "px";
			R.coordsize = 1000 + aH + 1000;
			R.coordorigin = d.coordorigin;
			var E = ay("shape"),
				i = E.style;
			i.width = d.width + "px";
			i.height = d.height + "px";
			E.coordsize = d.coordsize;
			E.coordorigin = d.coordorigin;
			R[bk](E);
			var S = new aU(E, R, d),
				b = {
					fill: "none",
					stroke: "#000"
				};
			e && (b.path = e);
			S.type = "path";
			S.path = [];
			S.Path = aP;
			an(S, b);
			d.canvas[bk](R);
			return S
		};
		an = function (bJ, bQ) {
			bJ.attrs = bJ.attrs || {};
			var bN = bJ.node,
				bR = bJ.attrs,
				S = bN.style,
				i, bP = (bQ.x != bR.x || bQ.y != bR.y || bQ.width != bR.width || bQ.height != bR.height || bQ.r != bR.r) && bJ.type == "rect",
				bV = bJ;
			for (var bH in bQ) {
				if (bQ[ag](bH)) {
					bR[bH] = bQ[bH]
				}
			}
			if (bP) {
				bR.path = at(bR.x, bR.y, bR.width, bR.height, bR.r);
				bJ.X = bR.x;
				bJ.Y = bR.y;
				bJ.W = bR.width;
				bJ.H = bR.height
			}
			bQ.href && (bN.href = bQ.href);
			bQ.title && (bN.title = bQ.title);
			bQ.target && (bN.target = bQ.target);
			bQ.cursor && (S.cursor = bQ.cursor);
			"blur" in bQ && bJ.blur(bQ.blur);
			if (bQ.path && bJ.type == "path" || bP) {
				bN.path = bg(bR.path)
			}
			if (bQ.rotation != null) {
				bJ.rotate(bQ.rotation, true)
			}
			if (bQ.translation) {
				i = bC(bQ.translation)[I](a);
				A.call(bJ, i[0], i[1]);
				if (bJ._.rt.cx != null) {
					bJ._.rt.cx += +i[0];
					bJ._.rt.cy += +i[1];
					bJ.setBox(bJ.attrs, i[0], i[1])
				}
			}
			if (bQ.scale) {
				i = bC(bQ.scale)[I](a);
				bJ.scale(+i[0] || 1, +i[1] || +i[0] || 1, +i[2] || null, +i[3] || null)
			}
			if ("clip-rect" in bQ) {
				var b = bC(bQ["clip-rect"])[I](a);
				if (b[s] == 4) {
					b[2] = +b[2] + (+b[0]);
					b[3] = +b[3] + (+b[1]);
					var bI = bN.clipRect || aa.createElement("div"),
						bU = bI.style,
						R = bN.parentNode;
					bU.clip = aI.format("rect({1}px {2}px {3}px {0}px)", b);
					if (!bN.clipRect) {
						bU.position = "absolute";
						bU.top = 0;
						bU.left = 0;
						bU.width = bJ.paper.width + "px";
						bU.height = bJ.paper.height + "px";
						R.parentNode.insertBefore(bI, R);
						bI[bk](R);
						bN.clipRect = bI
					}
				}
				if (!bQ["clip-rect"]) {
					bN.clipRect && (bN.clipRect.style.clip = aP)
				}
			}
			if (bJ.type == "image" && bQ.src) {
				bN.src = bQ.src
			}
			if (bJ.type == "image" && bQ.opacity) {
				bN.filterOpacity = a5 + ".Alpha(opacity=" + (bQ.opacity * 100) + ")";
				S.filter = (bN.filterMatrix || aP) + (bN.filterOpacity || aP)
			}
			bQ.font && (S.font = bQ.font);
			bQ["font-family"] && (S.fontFamily = '"' + bQ["font-family"][I](",")[0][bs](/^['"]+|['"]+$/g, aP) + '"');
			bQ["font-size"] && (S.fontSize = bQ["font-size"]);
			bQ["font-weight"] && (S.fontWeight = bQ["font-weight"]);
			bQ["font-style"] && (S.fontStyle = bQ["font-style"]);
			if (bQ.opacity != null || bQ["stroke-width"] != null || bQ.fill != null || bQ.stroke != null || bQ["stroke-width"] != null || bQ["stroke-opacity"] != null || bQ["fill-opacity"] != null || bQ["stroke-dasharray"] != null || bQ["stroke-miterlimit"] != null || bQ["stroke-linejoin"] != null || bQ["stroke-linecap"] != null) {
				bN = bJ.shape || bN;
				var bO = (bN.getElementsByTagName(a4) && bN.getElementsByTagName(a4)[0]),
					bS = false;
				!bO && (bS = bO = ay(a4));
				if ("fill-opacity" in bQ || "opacity" in bQ) {
					var d = ((+bR["fill-opacity"] + 1 || 2) - 1) * ((+bR.opacity + 1 || 2) - 1) * ((+aI.getRGB(bQ.fill).o + 1 || 2) - 1);
					d = bi(m(d, 0), 1);
					bO.opacity = d
				}
				bQ.fill && (bO.on = true);
				if (bO.on == null || bQ.fill == "none") {
					bO.on = false
				}
				if (bO.on && bQ.fill) {
					var e = bQ.fill.match(h);
					if (e) {
						bO.src = e[1];
						bO.type = "tile"
					} else {
						bO.color = aI.getRGB(bQ.fill).hex;
						bO.src = aP;
						bO.type = "solid";
						if (aI.getRGB(bQ.fill).error && (bV.type in {
								circle: 1,
								ellipse: 1
							} || bC(bQ.fill).charAt() != "r") && g(bV, bQ.fill)) {
							bR.fill = "none";
							bR.gradient = bQ.fill
						}
					}
				}
				bS && bN[bk](bO);
				var E = (bN.getElementsByTagName("stroke") && bN.getElementsByTagName("stroke")[0]),
					bT = false;
				!E && (bT = E = ay("stroke"));
				if ((bQ.stroke && bQ.stroke != "none") || bQ["stroke-width"] || bQ["stroke-opacity"] != null || bQ["stroke-dasharray"] || bQ["stroke-miterlimit"] || bQ["stroke-linejoin"] || bQ["stroke-linecap"]) {
					E.on = true
				}(bQ.stroke == "none" || E.on == null || bQ.stroke == 0 || bQ["stroke-width"] == 0) && (E.on = false);
				var bM = aI.getRGB(bQ.stroke);
				E.on && bQ.stroke && (E.color = bM.hex);
				d = ((+bR["stroke-opacity"] + 1 || 2) - 1) * ((+bR.opacity + 1 || 2) - 1) * ((+bM.o + 1 || 2) - 1);
				var bK = (aj(bQ["stroke-width"]) || 1) * 0.75;
				d = bi(m(d, 0), 1);
				bQ["stroke-width"] == null && (bK = bR["stroke-width"]);
				bQ["stroke-width"] && (E.weight = bK);
				bK && bK < 1 && (d *= bK) && (E.weight = 1);
				E.opacity = d;
				bQ["stroke-linejoin"] && (E.joinstyle = bQ["stroke-linejoin"] || "miter");
				E.miterlimit = bQ["stroke-miterlimit"] || 8;
				bQ["stroke-linecap"] && (E.endcap = bQ["stroke-linecap"] == "butt" ? "flat" : bQ["stroke-linecap"] == "square" ? "square" : "round");
				if (bQ["stroke-dasharray"]) {
					var bL = {
						"-": "shortdash",
						".": "shortdot",
						"-.": "shortdashdot",
						"-..": "shortdashdotdot",
						". ": "dot",
						"- ": "dash",
						"--": "longdash",
						"- .": "dashdot",
						"--.": "longdashdot",
						"--..": "longdashdotdot"
					};
					E.dashstyle = bL[ag](bQ["stroke-dasharray"]) ? bL[bQ["stroke-dasharray"]] : aP
				}
				bT && bN[bk](E)
			}
			if (bV.type == "text") {
				S = bV.paper.span.style;
				bR.font && (S.font = bR.font);
				bR["font-family"] && (S.fontFamily = bR["font-family"]);
				bR["font-size"] && (S.fontSize = bR["font-size"]);
				bR["font-weight"] && (S.fontWeight = bR["font-weight"]);
				bR["font-style"] && (S.fontStyle = bR["font-style"]);
				bV.node.string && (bV.paper.span.innerHTML = bC(bV.node.string)[bs](/</g, "&#60;")[bs](/&/g, "&#38;")[bs](/\n/g, "<br>"));
				bV.W = bR.w = bV.paper.span.offsetWidth;
				bV.H = bR.h = bV.paper.span.offsetHeight;
				bV.X = bR.x;
				bV.Y = bR.y + ad(bV.H / 2);
				switch (bR["text-anchor"]) {
					case "start":
						bV.node.style["v-text-align"] = "left";
						bV.bbx = ad(bV.W / 2);
						break;
					case "end":
						bV.node.style["v-text-align"] = "right";
						bV.bbx = -ad(bV.W / 2);
						break;
					default:
						bV.node.style["v-text-align"] = "center";
						break
				}
			}
		};
		g = function (b, bH) {
			b.attrs = b.attrs || {};
			var bI = b.attrs,
				bK, R = "linear",
				S = ".5 .5";
			b.attrs.gradient = bH;
			bH = bC(bH)[bs](aO, function (bM, bN, i) {
				R = "radial";
				if (bN && i) {
					bN = aj(bN);
					i = aj(i);
					bl(bN - 0.5, 2) + bl(i - 0.5, 2) > 0.25 && (i = ao.sqrt(0.25 - bl(bN - 0.5, 2)) * ((i > 0.5) * 2 - 1) + 0.5);
					S = bN + aH + i
				}
				return aP
			});
			bH = bH[I](/\s*\-\s*/);
			if (R == "linear") {
				var d = bH.shift();
				d = -aj(d);
				if (isNaN(d)) {
					return null
				}
			}
			var E = w(bH);
			if (!E) {
				return null
			}
			b = b.shape || b.node;
			bK = b.getElementsByTagName(a4)[0] || ay(a4);
			!bK.parentNode && b.appendChild(bK);
			if (E[s]) {
				bK.on = true;
				bK.method = "none";
				bK.color = E[0].color;
				bK.color2 = E[E[s] - 1].color;
				var bL = [];
				for (var e = 0, bJ = E[s]; e < bJ; e++) {
					E[e].offset && bL[k](E[e].offset + aH + E[e].color)
				}
				bK.colors && (bK.colors.value = bL[s] ? bL[aW]() : "0% " + bK.color);
				if (R == "radial") {
					bK.type = "gradientradial";
					bK.focus = "100%";
					bK.focussize = S;
					bK.focusposition = S
				} else {
					bK.type = "gradient";
					bK.angle = (270 - d) % 360
				}
			}
			return 1
		};
		aU = function (E, S, b) {
			var R = 0,
				e = 0,
				d = 0,
				i = 1;
			this[0] = E;
			this.id = aI._oid++;
			this.node = E;
			E.raphael = this;
			this.X = 0;
			this.Y = 0;
			this.attrs = {};
			this.Group = S;
			this.paper = b;
			this._ = {
				tx: 0,
				ty: 0,
				rt: {
					deg: 0
				},
				sx: 1,
				sy: 1
			};
			!b.bottom && (b.bottom = this);
			this.prev = b.top;
			b.top && (b.top.next = this);
			b.top = this;
			this.next = null
		};
		bc = aU[bE];
		bc.rotate = function (d, b, e) {
			if (this.removed) {
				return this
			}
			if (d == null) {
				if (this._.rt.cx) {
					return [this._.rt.deg, this._.rt.cx, this._.rt.cy][aW](aH)
				}
				return this._.rt.deg
			}
			d = bC(d)[I](a);
			if (d[s] - 1) {
				b = aj(d[1]);
				e = aj(d[2])
			}
			d = aj(d[0]);
			if (b != null) {
				this._.rt.deg = d
			} else {
				this._.rt.deg += d
			}
			e == null && (b = null);
			this._.rt.cx = b;
			this._.rt.cy = e;
			this.setBox(this.attrs, b, e);
			this.Group.style.rotation = this._.rt.deg;
			return this
		};
		bc.setBox = function (E, R, e) {
			if (this.removed) {
				return this
			}
			var b = this.Group.style,
				S = (this.shape && this.shape.style) || this.node.style;
			E = E || {};
			for (var bH in E) {
				if (E[ag](bH)) {
					this.attrs[bH] = E[bH]
				}
			}
			R = R || this._.rt.cx;
			e = e || this._.rt.cy;
			var bK = this.attrs,
				bN, bM, bO, bJ;
			switch (this.type) {
				case "circle":
					bN = bK.cx - bK.r;
					bM = bK.cy - bK.r;
					bO = bJ = bK.r * 2;
					break;
				case "ellipse":
					bN = bK.cx - bK.rx;
					bM = bK.cy - bK.ry;
					bO = bK.rx * 2;
					bJ = bK.ry * 2;
					break;
				case "image":
					bN = +bK.x;
					bM = +bK.y;
					bO = bK.width || 0;
					bJ = bK.height || 0;
					break;
				case "text":
					this.textpath.v = ["m", ad(bK.x), ", ", ad(bK.y - 2), "l", ad(bK.x) + 1, ", ", ad(bK.y - 2)][aW](aP);
					bN = bK.x - ad(this.W / 2);
					bM = bK.y - this.H / 2;
					bO = this.W;
					bJ = this.H;
					break;
				case "rect":
				case "path":
					if (!this.attrs.path) {
						bN = 0;
						bM = 0;
						bO = this.paper.width;
						bJ = this.paper.height
					} else {
						var bI = ai(this.attrs.path);
						bN = bI.x;
						bM = bI.y;
						bO = bI.width;
						bJ = bI.height
					}
					break;
				default:
					bN = 0;
					bM = 0;
					bO = this.paper.width;
					bJ = this.paper.height;
					break
			}
			R = (R == null) ? bN + bO / 2 : R;
			e = (e == null) ? bM + bJ / 2 : e;
			var d = R - this.paper.width / 2,
				bL = e - this.paper.height / 2,
				bP;
			b.left != (bP = d + "px") && (b.left = bP);
			b.top != (bP = bL + "px") && (b.top = bP);
			this.X = t[ag](this.type) ? -d : bN;
			this.Y = t[ag](this.type) ? -bL : bM;
			this.W = bO;
			this.H = bJ;
			if (t[ag](this.type)) {
				S.left != (bP = -d * u + "px") && (S.left = bP);
				S.top != (bP = -bL * u + "px") && (S.top = bP)
			} else {
				if (this.type == "text") {
					S.left != (bP = -d + "px") && (S.left = bP);
					S.top != (bP = -bL + "px") && (S.top = bP)
				} else {
					b.width != (bP = this.paper.width + "px") && (b.width = bP);
					b.height != (bP = this.paper.height + "px") && (b.height = bP);
					S.left != (bP = bN - d + "px") && (S.left = bP);
					S.top != (bP = bM - bL + "px") && (S.top = bP);
					S.width != (bP = bO + "px") && (S.width = bP);
					S.height != (bP = bJ + "px") && (S.height = bP)
				}
			}
		};
		bc.hide = function () {
			!this.removed && (this.Group.style.display = "none");
			return this
		};
		bc.show = function () {
			!this.removed && (this.Group.style.display = "block");
			return this
		};
		bc.getBBox = function () {
			if (this.removed) {
				return this
			}
			if (t[ag](this.type)) {
				return ai(this.attrs.path)
			}
			return {
				x: this.X + (this.bbx || 0),
				y: this.Y,
				width: this.W,
				height: this.H
			}
		};
		bc.remove = function () {
			if (this.removed) {
				return
			}
			aE(this, this.paper);
			this.node.parentNode.removeChild(this.node);
			this.Group.parentNode.removeChild(this.Group);
			this.shape && this.shape.parentNode.removeChild(this.shape);
			for (var b in this) {
				delete this[b]
			}
			this.removed = true
		};
		bc.attr = function (b, bH) {
			if (this.removed) {
				return this
			}
			if (b == null) {
				var S = {};
				for (var E in this.attrs) {
					if (this.attrs[ag](E)) {
						S[E] = this.attrs[E]
					}
				}
				this._.rt.deg && (S.rotation = this.rotate());
				(this._.sx != 1 || this._.sy != 1) && (S.scale = this.scale());
				S.gradient && S.fill == "none" && (S.fill = S.gradient) && delete S.gradient;
				return S
			}
			if (bH == null && aI.is(b, "string")) {
				if (b == "translation") {
					return A.call(this)
				}
				if (b == "rotation") {
					return this.rotate()
				}
				if (b == "scale") {
					return this.scale()
				}
				if (b == a4 && this.attrs.fill == "none" && this.attrs.gradient) {
					return this.attrs.gradient
				}
				return this.attrs[b]
			}
			if (this.attrs && bH == null && aI.is(b, a7)) {
				var bK, bJ = {};
				for (E = 0, bK = b[s]; E < bK; E++) {
					bJ[b[E]] = this.attr(b[E])
				}
				return bJ
			}
			var d;
			if (bH != null) {
				d = {};
				d[b] = bH
			}
			bH == null && aI.is(b, "object") && (d = b);
			if (d) {
				for (var bI in this.paper.customAttributes) {
					if (this.paper.customAttributes[ag](bI) && d[ag](bI) && aI.is(this.paper.customAttributes[bI], "function")) {
						var R = this.paper.customAttributes[bI].apply(this, [][bw](d[bI]));
						this.attrs[bI] = d[bI];
						for (var e in R) {
							if (R[ag](e)) {
								d[e] = R[e]
							}
						}
					}
				}
				if (d.text && this.type == "text") {
					this.node.string = d.text
				}
				an(this, d);
				if (d.gradient && (({
						circle: 1,
						ellipse: 1
					})[ag](this.type) || bC(d.gradient).charAt() != "r")) {
					g(this, d.gradient)
				}(!t[ag](this.type) || this._.rt.deg) && this.setBox(this.attrs)
			}
			return this
		};
		bc.toFront = function () {
			!this.removed && this.Group.parentNode[bk](this.Group);
			this.paper.top != this && al(this, this.paper);
			return this
		};
		bc.toBack = function () {
			if (this.removed) {
				return this
			}
			if (this.Group.parentNode.firstChild != this.Group) {
				this.Group.parentNode.insertBefore(this.Group, this.Group.parentNode.firstChild);
				p(this, this.paper)
			}
			return this
		};
		bc.insertAfter = function (b) {
			if (this.removed) {
				return this
			}
			if (b.constructor == ah) {
				b = b[b.length - 1]
			}
			if (b.Group.nextSibling) {
				b.Group.parentNode.insertBefore(this.Group, b.Group.nextSibling)
			} else {
				b.Group.parentNode[bk](this.Group)
			}
			J(this, b, this.paper);
			return this
		};
		bc.insertBefore = function (b) {
			if (this.removed) {
				return this
			}
			if (b.constructor == ah) {
				b = b[0]
			}
			b.Group.parentNode.insertBefore(this.Group, b.Group);
			aL(this, b, this.paper);
			return this
		};
		bc.blur = function (b) {
			var d = this.node.runtimeStyle,
				e = d.filter;
			e = e.replace(bx, aP);
			if (+b !== 0) {
				this.attrs.blur = b;
				d.filter = e + aH + a5 + ".Blur(pixelradius=" + (+b || 1.5) + ")";
				d.margin = aI.format("-{0}px 0 0 -{0}px", ad(+b || 1.5))
			} else {
				d.filter = e;
				d.margin = 0;
				delete this.attrs.blur
			}
		};
		ae = function (d, b, bH, R) {
			var E = ay("group"),
				S = ay("oval"),
				e = S.style;
			E.style.cssText = "position:absolute;left:0;top:0;width:" + d.width + "px;height:" + d.height + "px";
			E.coordsize = aX;
			E.coordorigin = d.coordorigin;
			E[bk](S);
			var i = new aU(S, E, d);
			i.type = "circle";
			an(i, {
				stroke: "#000",
				fill: "none"
			});
			i.attrs.cx = b;
			i.attrs.cy = bH;
			i.attrs.r = R;
			i.setBox({
				x: b - R,
				y: bH - R,
				width: R * 2,
				height: R * 2
			});
			d.canvas[bk](E);
			return i
		};

		function at(b, E, d, e, i) {
			if (i) {
				return aI.format("M{0},{1}l{2},0a{3},{3},0,0,1,{3},{3}l0,{5}a{3},{3},0,0,1,{4},{3}l{6},0a{3},{3},0,0,1,{4},{4}l0,{7}a{3},{3},0,0,1,{3},{4}z", b + i, E, d - i * 2, i, -i, e - i * 2, i * 2 - d, i * 2 - e)
			} else {
				return aI.format("M{0},{1}l{2},0,0,{3},{4},0z", b, E, d, e, -d)
			}
		}
		bb = function (d, S, E, bH, e, b) {
			var bI = at(S, E, bH, e, b),
				i = d.path(bI),
				R = i.attrs;
			i.X = R.x = S;
			i.Y = R.y = E;
			i.W = R.width = bH;
			i.H = R.height = e;
			R.r = b;
			R.path = bI;
			i.type = "rect";
			return i
		};
		az = function (b, bI, bH, e, d) {
			var E = ay("group"),
				i = ay("oval"),
				S = i.style;
			E.style.cssText = "position:absolute;left:0;top:0;width:" + b.width + "px;height:" + b.height + "px";
			E.coordsize = aX;
			E.coordorigin = b.coordorigin;
			E[bk](i);
			var R = new aU(i, E, b);
			R.type = "ellipse";
			an(R, {
				stroke: "#000"
			});
			R.attrs.cx = bI;
			R.attrs.cy = bH;
			R.attrs.rx = e;
			R.attrs.ry = d;
			R.setBox({
				x: bI - e,
				y: bH - d,
				width: e * 2,
				height: d * 2
			});
			b.canvas[bk](E);
			return R
		};
		v = function (d, b, bH, S, bI, i) {
			var E = ay("group"),
				e = ay("image");
			E.style.cssText = "position:absolute;left:0;top:0;width:" + d.width + "px;height:" + d.height + "px";
			E.coordsize = aX;
			E.coordorigin = d.coordorigin;
			e.src = b;
			E[bk](e);
			var R = new aU(e, E, d);
			R.type = "image";
			R.attrs.src = b;
			R.attrs.x = bH;
			R.attrs.y = S;
			R.attrs.w = bI;
			R.attrs.h = i;
			R.setBox({
				x: bH,
				y: S,
				width: bI,
				height: i
			});
			d.canvas[bk](E);
			return R
		};
		ak = function (d, bI, bH, bJ) {
			var E = ay("group"),
				i = ay("shape"),
				S = i.style,
				bK = ay("path"),
				b = bK.style,
				e = ay("textpath");
			E.style.cssText = "position:absolute;left:0;top:0;width:" + d.width + "px;height:" + d.height + "px";
			E.coordsize = aX;
			E.coordorigin = d.coordorigin;
			bK.v = aI.format("m{0},{1}l{2},{1}", ad(bI * 10), ad(bH * 10), ad(bI * 10) + 1);
			bK.textpathok = true;
			S.width = d.width;
			S.height = d.height;
			e.string = bC(bJ);
			e.on = true;
			i[bk](e);
			i[bk](bK);
			E[bk](i);
			var R = new aU(e, E, d);
			R.shape = i;
			R.textpath = bK;
			R.type = "text";
			R.attrs.text = bJ;
			R.attrs.x = bI;
			R.attrs.y = bH;
			R.attrs.w = 1;
			R.attrs.h = 1;
			an(R, {
				font: q.font,
				stroke: "none",
				fill: "#000"
			});
			R.setBox();
			d.canvas[bk](E);
			return R
		};
		bA = function (e, b) {
			var d = this.canvas.style;
			e == +e && (e += "px");
			b == +b && (b += "px");
			d.width = e;
			d.height = b;
			d.clip = "rect(0 " + e + " " + b + " 0)";
			return this
		};
		var ay;
		aa.createStyleSheet().addRule(".rvml", "behavior:url(#default#VML)");
		try {
			!aa.namespaces.rvml && aa.namespaces.add("rvml", "urn:schemas-microsoft-com:vml");
			ay = function (b) {
				return aa.createElement("<rvml:" + b + ' class="rvml">')
			}
		} catch (aw) {
			ay = function (b) {
				return aa.createElement("<" + b + ' xmlns="urn:schemas-microsoft.com:vml" class="rvml">')
			}
		}
		F = function () {
			var e = aJ[bB](0, arguments),
				b = e.container,
				bK = e.height,
				bM, d = e.width,
				bJ = e.x,
				bI = e.y,
				bL = e.cordSize,
				E = e.cordOrigin,
				i = e.vmlSize;
			if (!b) {
				throw new Error("VML container not found.")
			}
			var S = new bz,
				bH = S.canvas = aa.createElement("div"),
				R = bH.style;
			bJ = bJ || 0;
			bI = bI || 0;
			d = d || 512;
			bK = bK || 342;
			d == +d && (d += "px");
			bK == +bK && (bK += "px");
			S.width = 1000;
			S.height = 1000;
			S.coordsize = i;
			S.coordorigin = "0 0";
			S.span = aa.createElement("span");
			S.span.style.cssText = "position:absolute;left:-9999em;top:-9999em;padding:0;margin:0;line-height:1;display:inline;";
			bH[bk](S.span);
			R.cssText = aI.format("top:0;left:0;width:{0};height:{1};display:inline-block;position:relative;clip:rect(0 {0} {1} 0);overflow:hidden", d, bK);
			if (b == 1) {
				aa.body[bk](bH);
				R.left = bJ + "px";
				R.top = bI + "px";
				R.position = "absolute"
			} else {
				if (b.firstChild) {
					b.insertBefore(bH, b.firstChild)
				} else {
					b[bk](bH)
				}
			}
			be.call(S, S, aI.fn);
			return S
		};
		aZ.clear = function () {
			this.canvas.innerHTML = aP;
			this.span = aa.createElement("span");
			this.span.style.cssText = "position:absolute;left:-9999em;top:-9999em;padding:0;margin:0;line-height:1;display:inline;";
			this.canvas[bk](this.span);
			this.bottom = this.top = null
		};
		aZ.remove = function () {
			this.canvas.parentNode.removeChild(this.canvas);
			for (var b in this) {
				this[b] = z(b)
			}
			return true
		}
	}
	var U = navigator.userAgent.match(/Version\/(.*?)\s/);
	if ((navigator.vendor == "Apple Computer, Inc.") && (U && U[1] < 4 || navigator.platform.slice(0, 2) == "iP")) {
		aZ.safari = function () {
			var b = this.rect(-99, -99, this.width + 99, this.height + 99).attr({
				stroke: "none"
			});
			aQ.setTimeout(function () {
				b.remove()
			})
		}
	} else {
		aZ.safari = function () {}
	}
	var O = function () {
			this.returnValue = false
		},
		bv = function () {
			return this.originalEvent.preventDefault()
		},
		a3 = function () {
			this.cancelBubble = true
		},
		aD = function () {
			return this.originalEvent.stopPropagation()
		},
		av = (function () {
			if (aa.addEventListener) {
				return function (R, i, e, d) {
					var b = W && bq[i] ? bq[i] : i;
					var E = function (bJ) {
						if (W && bq[ag](i)) {
							for (var bH = 0, bI = bJ.targetTouches && bJ.targetTouches.length; bH < bI; bH++) {
								if (bJ.targetTouches[bH].target == R) {
									var S = bJ;
									bJ = bJ.targetTouches[bH];
									bJ.originalEvent = S;
									bJ.preventDefault = bv;
									bJ.stopPropagation = aD;
									break
								}
							}
						}
						return e.call(d, bJ)
					};
					R.addEventListener(b, E, false);
					return function () {
						R.removeEventListener(b, E, false);
						return true
					}
				}
			} else {
				if (aa.attachEvent) {
					return function (R, i, e, d) {
						var E = function (S) {
							S = S || aQ.event;
							S.preventDefault = S.preventDefault || O;
							S.stopPropagation = S.stopPropagation || a3;
							return e.call(d, S)
						};
						R.attachEvent("on" + i, E);
						var b = function () {
							R.detachEvent("on" + i, E);
							return true
						};
						return b
					}
				}
			}
		})(),
		a8 = [],
		br = function (S) {
			var bI = S.clientX,
				bH = S.clientY,
				bJ = aa.documentElement.scrollTop || aa.body.scrollTop,
				bK = aa.documentElement.scrollLeft || aa.body.scrollLeft,
				b, d = a8.length;
			while (d--) {
				b = a8[d];
				if (W) {
					var R = S.touches.length,
						E;
					while (R--) {
						E = S.touches[R];
						if (E.identifier == b.el._drag.id) {
							bI = E.clientX;
							bH = E.clientY;
							(S.originalEvent ? S.originalEvent : S).preventDefault();
							break
						}
					}
				} else {
					S.preventDefault()
				}
				bI += bK;
				bH += bJ;
				b.move && b.move.call(b.move_scope || b.el, bI - b.el._drag.x, bH - b.el._drag.y, bI, bH, S)
			}
		},
		f = function (E) {
			aI.unmousemove(br).unmouseup(f);
			var d = a8.length,
				b;
			while (d--) {
				b = a8[d];
				b.el._drag = {};
				b.end && b.end.call(b.end_scope || b.start_scope || b.move_scope || b.el, E)
			}
			a8 = []
		};
	for (var ar = Q[s]; ar--;) {
		(function (b) {
			aI[b] = aU[bE][b] = function (e, d) {
				if (aI.is(e, "function")) {
					this.events = this.events || [];
					this.events.push({
						name: b,
						f: e,
						unbind: av(this.shape || this.node || aa, b, e, d || this)
					})
				}
				return this
			};
			aI["un" + b] = aU[bE]["un" + b] = function (i) {
				var e = this.events,
					d = e[s];
				while (d--) {
					if (e[d].name == b && e[d].f == i) {
						e[d].unbind();
						e.splice(d, 1);
						!e.length && delete this.events;
						return this
					}
				}
				return this
			}
		})(Q[ar])
	}
	bc.hover = function (i, b, e, d) {
		return this.mouseover(i, e).mouseout(b, d || e)
	};
	bc.unhover = function (d, b) {
		return this.unmouseover(d).unmouseout(b)
	};
	bc.drag = function (d, R, E, b, e, i) {
		this._drag = {};
		this.mousedown(function (bH) {
			(bH.originalEvent || bH).preventDefault();
			var S = aa.documentElement.scrollTop || aa.body.scrollTop,
				bI = aa.documentElement.scrollLeft || aa.body.scrollLeft;
			this._drag.x = bH.clientX + bI;
			this._drag.y = bH.clientY + S;
			this._drag.id = bH.identifier;
			R && R.call(e || b || this, bH.clientX + bI, bH.clientY + S, bH);
			!a8.length && aI.mousemove(br).mouseup(f);
			a8.push({
				el: this,
				move: d,
				end: E,
				move_scope: b,
				start_scope: e,
				end_scope: i
			})
		});
		return this
	};
	bc.undrag = function (b, E, e) {
		var d = a8.length;
		while (d--) {
			a8[d].el == this && (a8[d].move == b && a8[d].end == e) && a8.splice(d++, 1)
		}!a8.length && aI.unmousemove(br).unmouseup(f)
	};
	aZ.circle = function (b, e, d) {
		return ae(this, b || 0, e || 0, d || 0)
	};
	aZ.rect = function (b, E, d, e, i) {
		return bb(this, b || 0, E || 0, d || 0, e || 0, i || 0)
	};
	aZ.ellipse = function (b, i, e, d) {
		return az(this, b || 0, i || 0, e || 0, d || 0)
	};
	aZ.path = function (b) {
		b && !aI.is(b, af) && !aI.is(b[0], a7) && (b += aP);
		return x(aI.format[bB](aI, arguments), this)
	};
	aZ.image = function (i, b, E, d, e) {
		return v(this, i || "about:blank", b || 0, E || 0, d || 0, e || 0)
	};
	aZ.text = function (b, e, d) {
		return ak(this, b || 0, e || 0, bC(d))
	};
	aZ.set = function (b) {
		arguments[s] > 1 && (b = Array[bE].splice.call(arguments, 0, arguments[s]));
		return new ah(b)
	};
	aZ.setSize = bA;
	aZ.top = aZ.bottom = null;
	aZ.raphael = aI;

	function C() {
		return this.x + aH + this.y
	}
	bc.resetScale = function () {
		if (this.removed) {
			return this
		}
		this._.sx = 1;
		this._.sy = 1;
		this.attrs.scale = "1 1"
	};
	bc.scale = function (bZ, bY, bQ, bO) {
		if (this.removed) {
			return this
		}
		if (bZ == null && bY == null) {
			return {
				x: this._.sx,
				y: this._.sy,
				toString: C
			}
		}
		bY = bY || bZ;
		!+bY && (bY = bZ);
		var d, b, b7, b6, ca = this.attrs;
		if (bZ != 0) {
			var cb = this.getBBox(),
				E = cb.x + cb.width / 2,
				e = cb.y + cb.height / 2,
				b4 = aq(bZ / this._.sx),
				b3 = aq(bY / this._.sy);
			bQ = (+bQ || bQ == 0) ? bQ : E;
			bO = (+bO || bO == 0) ? bO : e;
			var bJ = this._.sx > 0,
				bI = this._.sy > 0,
				bP = ~~(bZ / aq(bZ)),
				bN = ~~(bY / aq(bY)),
				S = b4 * bP,
				R = b3 * bN,
				b0 = this.node.style,
				bX = bQ + aq(E - bQ) * S * (E > bQ == bJ ? 1 : -1),
				bW = bO + aq(e - bO) * R * (e > bO == bI ? 1 : -1),
				bT = (bZ * bP > bY * bN ? b3 : b4);
			switch (this.type) {
				case "rect":
				case "image":
					var bL = ca.width * b4,
						bU = ca.height * b3;
					this.attr({
						height: bU,
						r: ca.r * bT,
						width: bL,
						x: bX - bL / 2,
						y: bW - bU / 2
					});
					break;
				case "circle":
				case "ellipse":
					this.attr({
						rx: ca.rx * b4,
						ry: ca.ry * b3,
						r: ca.r * bT,
						cx: bX,
						cy: bW
					});
					break;
				case "text":
					this.attr({
						x: bX,
						y: bW
					});
					break;
				case "path":
					var b2 = au(ca.path),
						bK = true,
						bS = bJ ? S : b4,
						bR = bI ? R : b3;
					for (var b9 = 0, bV = b2[s]; b9 < bV; b9++) {
						var b5 = b2[b9],
							bM = bo.call(b5[0]);
						if (bM == "M" && bK) {
							continue
						} else {
							bK = false
						}
						if (bM == "A") {
							b5[b2[b9][s] - 2] *= bS;
							b5[b2[b9][s] - 1] *= bR;
							b5[1] *= b4;
							b5[2] *= b3;
							b5[5] = +(bP + bN ? !!+b5[5] : !+b5[5])
						} else {
							if (bM == "H") {
								for (var b8 = 1, bH = b5[s]; b8 < bH; b8++) {
									b5[b8] *= bS
								}
							} else {
								if (bM == "V") {
									for (b8 = 1, bH = b5[s]; b8 < bH; b8++) {
										b5[b8] *= bR
									}
								} else {
									for (b8 = 1, bH = b5[s]; b8 < bH; b8++) {
										b5[b8] *= (b8 % 2) ? bS : bR
									}
								}
							}
						}
					}
					var b1 = ai(b2);
					d = bX - b1.x - b1.width / 2;
					b = bW - b1.y - b1.height / 2;
					b2[0][1] += d;
					b2[0][2] += b;
					this.attr({
						path: b2
					});
					break
			}
			if (this.type in {
					text: 1,
					image: 1
				} && (bP != 1 || bN != 1)) {
				if (this.transformations) {
					this.transformations[2] = "scale(" [bw](bP, ",", bN, ")");
					this.node[D]("transform", this.transformations[aW](aH));
					d = (bP == -1) ? -ca.x - (bL || 0) : ca.x;
					b = (bN == -1) ? -ca.y - (bU || 0) : ca.y;
					this.attr({
						x: d,
						y: b
					});
					ca.fx = bP - 1;
					ca.fy = bN - 1
				} else {
					this.node.filterMatrix = a5 + ".Matrix(M11=" [bw](bP, ", M12=0, M21=0, M22=", bN, ", Dx=0, Dy=0, sizingmethod='auto expand', filtertype='bilinear')");
					b0.filter = (this.node.filterMatrix || aP) + (this.node.filterOpacity || aP)
				}
			} else {
				if (this.transformations) {
					this.transformations[2] = aP;
					this.node[D]("transform", this.transformations[aW](aH));
					ca.fx = 0;
					ca.fy = 0
				} else {
					this.node.filterMatrix = aP;
					b0.filter = (this.node.filterMatrix || aP) + (this.node.filterOpacity || aP)
				}
			}
			ca.scale = [bZ, bY, bQ, bO][aW](aH);
			this._.sx = bZ;
			this._.sy = bY
		}
		return this
	};
	bc.clone = function () {
		if (this.removed) {
			return null
		}
		var b = this.attr();
		delete b.scale;
		delete b.translation;
		return this.paper[this.type]().attr(b)
	};
	var a2 = {},
		l = function (R, d, bJ, bI, bR, bQ, bP, bN, S) {
			var bM = 0,
				bL = 100,
				E = [R, d, bJ, bI, bR, bQ, bP, bN].join(),
				b = a2[E],
				bH, e;
			!b && (a2[E] = b = {
				data: []
			});
			b.timer && clearTimeout(b.timer);
			b.timer = setTimeout(function () {
				delete a2[E]
			}, 2000);
			if (S != null) {
				var bO = l(R, d, bJ, bI, bR, bQ, bP, bN);
				bL = ~~bO * 10
			}
			for (var bK = 0; bK < bL + 1; bK++) {
				if (b.data[S] > bK) {
					e = b.data[bK * bL]
				} else {
					e = aI.findDotsAtSegment(R, d, bJ, bI, bR, bQ, bP, bN, bK / bL);
					b.data[bK] = e
				}
				bK && (bM += bl(bl(bH.x - e.x, 2) + bl(bH.y - e.y, 2), 0.5));
				if (S != null && bM >= S) {
					return e
				}
				bH = e
			}
			if (S == null) {
				return bM
			}
		},
		a1 = function (b, d) {
			return function (bP, R, S) {
				bP = V(bP);
				var bL, bK, e, bH, E = "",
					bO = {},
					bM, bJ = 0;
				for (var bI = 0, bN = bP.length; bI < bN; bI++) {
					e = bP[bI];
					if (e[0] == "M") {
						bL = +e[1];
						bK = +e[2]
					} else {
						bH = l(bL, bK, e[1], e[2], e[3], e[4], e[5], e[6]);
						if (bJ + bH > R) {
							if (d && !bO.start) {
								bM = l(bL, bK, e[1], e[2], e[3], e[4], e[5], e[6], R - bJ);
								E += ["C", bM.start.x, bM.start.y, bM.m.x, bM.m.y, bM.x, bM.y];
								if (S) {
									return E
								}
								bO.start = E;
								E = ["M", bM.x, bM.y + "C", bM.n.x, bM.n.y, bM.end.x, bM.end.y, e[5], e[6]][aW]();
								bJ += bH;
								bL = +e[5];
								bK = +e[6];
								continue
							}
							if (!b && !d) {
								bM = l(bL, bK, e[1], e[2], e[3], e[4], e[5], e[6], R - bJ);
								return {
									x: bM.x,
									y: bM.y,
									alpha: bM.alpha
								}
							}
						}
						bJ += bH;
						bL = +e[5];
						bK = +e[6]
					}
					E += e
				}
				bO.end = E;
				bM = b ? bJ : d ? bO : aI.findDotsAtSegment(bL, bK, e[1], e[2], e[3], e[4], e[5], e[6], 1);
				bM.alpha && (bM = {
					x: bM.x,
					y: bM.y,
					alpha: bM.alpha
				});
				return bM
			}
		};
	var aK = a1(1),
		L = a1(),
		Y = a1(0, 1);
	bc.getTotalLength = function () {
		if (this.type != "path") {
			return
		}
		if (this.node.getTotalLength) {
			return this.node.getTotalLength()
		}
		return aK(this.attrs.path)
	};
	bc.getPointAtLength = function (b) {
		if (this.type != "path") {
			return
		}
		return L(this.attrs.path, b)
	};
	bc.getSubpath = function (e, d) {
		if (this.type != "path") {
			return
		}
		if (aq(this.getTotalLength() - d) < "1e-6") {
			return Y(this.attrs.path, e).end
		}
		var b = Y(this.attrs.path, d, 1);
		return e ? Y(b, e).end : b
	};
	aI.easing_formulas = {
		linear: function (b) {
			return b
		},
		"<": function (b) {
			return bl(b, 3)
		},
		">": function (b) {
			return bl(b - 1, 3) + 1
		},
		"<>": function (b) {
			b = b * 2;
			if (b < 1) {
				return bl(b, 3) / 2
			}
			b -= 2;
			return (bl(b, 3) + 2) / 2
		},
		backIn: function (d) {
			var b = 1.70158;
			return d * d * ((b + 1) * d - b)
		},
		backOut: function (d) {
			d = d - 1;
			var b = 1.70158;
			return d * d * ((b + 1) * d + b) + 1
		},
		elastic: function (e) {
			if (e == 0 || e == 1) {
				return e
			}
			var d = 0.3,
				b = d / 4;
			return bl(2, -10 * e) * ao.sin((e - b) * (2 * aM) / d) + 1
		},
		bounce: function (i) {
			var d = 7.5625,
				e = 2.75,
				b;
			if (i < (1 / e)) {
				b = d * i * i
			} else {
				if (i < (2 / e)) {
					i -= (1.5 / e);
					b = d * i * i + 0.75
				} else {
					if (i < (2.5 / e)) {
						i -= (2.25 / e);
						b = d * i * i + 0.9375
					} else {
						i -= (2.625 / e);
						b = d * i * i + 0.984375
					}
				}
			}
			return b
		}
	};
	var X = [],
		bu = function () {
			var bI = +new Date;
			for (var bT = 0; bT < X[s]; bT++) {
				var bY = X[bT];
				if (bY.stop || bY.el.removed) {
					continue
				}
				var R = bI - bY.start,
					bQ = bY.ms,
					bP = bY.easing,
					bU = bY.from,
					bN = bY.diff,
					d = bY.to,
					bM = bY.t,
					bH = bY.el,
					bO = {},
					b;
				if (R < bQ) {
					var E = bP(R / bQ);
					for (var bR in bU) {
						if (bU[ag](bR)) {
							switch (am[bR]) {
								case "along":
									b = E * bQ * bN[bR];
									d.back && (b = d.len - b);
									var bS = L(d[bR], b);
									bH.translate(bN.sx - bN.x || 0, bN.sy - bN.y || 0);
									bN.x = bS.x;
									bN.y = bS.y;
									bH.translate(bS.x - bN.sx, bS.y - bN.sy);
									d.rot && bH.rotate(bN.r + bS.alpha, bS.x, bS.y);
									break;
								case aF:
									b = +bU[bR] + E * bQ * bN[bR];
									break;
								case "colour":
									b = "rgb(" + [K(ad(bU[bR].r + E * bQ * bN[bR].r)), K(ad(bU[bR].g + E * bQ * bN[bR].g)), K(ad(bU[bR].b + E * bQ * bN[bR].b))][aW](",") + ")";
									break;
								case "path":
									b = [];
									for (var bW = 0, bL = bU[bR][s]; bW < bL; bW++) {
										b[bW] = [bU[bR][bW][0]];
										for (var bV = 1, bX = bU[bR][bW][s]; bV < bX; bV++) {
											b[bW][bV] = +bU[bR][bW][bV] + E * bQ * bN[bR][bW][bV]
										}
										b[bW] = b[bW][aW](aH)
									}
									b = b[aW](aH);
									break;
								case "csv":
									switch (bR) {
										case "translation":
											var bK = E * bQ * bN[bR][0] - bM.x,
												bJ = E * bQ * bN[bR][1] - bM.y;
											bM.x += bK;
											bM.y += bJ;
											b = bK + aH + bJ;
											break;
										case "rotation":
											b = +bU[bR][0] + E * bQ * bN[bR][0];
											bU[bR][1] && (b += "," + bU[bR][1] + "," + bU[bR][2]);
											break;
										case "scale":
											b = [+bU[bR][0] + E * bQ * bN[bR][0], +bU[bR][1] + E * bQ * bN[bR][1], (2 in d[bR] ? d[bR][2] : aP), (3 in d[bR] ? d[bR][3] : aP)][aW](aH);
											break;
										case "clip-rect":
											b = [];
											bW = 4;
											while (bW--) {
												b[bW] = +bU[bR][bW] + E * bQ * bN[bR][bW]
											}
											break
									}
									break;
								default:
									var S = [].concat(bU[bR]);
									b = [];
									bW = bH.paper.customAttributes[bR].length;
									while (bW--) {
										b[bW] = +S[bW] + E * bQ * bN[bR][bW]
									}
									break
							}
							bO[bR] = b
						}
					}
					bH.attr(bO);
					bH._run && bH._run.call(bH)
				} else {
					if (d.along) {
						bS = L(d.along, d.len * !d.back);
						bH.translate(bN.sx - (bN.x || 0) + bS.x - bN.sx, bN.sy - (bN.y || 0) + bS.y - bN.sy);
						d.rot && bH.rotate(bN.r + bS.alpha, bS.x, bS.y)
					}(bM.x || bM.y) && bH.translate(-bM.x, -bM.y);
					d.scale && (d.scale += aP);
					bH.attr(d);
					X.splice(bT--, 1)
				}
			}
			aI.svg && bH && bH.paper && bH.paper.safari();
			X[s] && setTimeout(bu)
		},
		by = function (b, e, R, E, i) {
			var d = R - E;
			e.timeouts.push(setTimeout(function () {
				aI.is(i, "function") && i.call(e);
				e.animate(b, d, b.easing)
			}, E))
		},
		K = function (b) {
			return m(bi(b, 255), 0)
		},
		A = function (b, e) {
			if (b == null) {
				return {
					x: this._.tx,
					y: this._.ty,
					toString: C
				}
			}
			this._.tx += +b;
			this._.ty += +e;
			switch (this.type) {
				case "circle":
				case "ellipse":
					this.attr({
						cx: +b + this.attrs.cx,
						cy: +e + this.attrs.cy
					});
					break;
				case "rect":
				case "image":
				case "text":
					this.attr({
						x: +b + this.attrs.x,
						y: +e + this.attrs.y
					});
					break;
				case "path":
					var d = au(this.attrs.path);
					d[0][1] += +b;
					d[0][2] += +e;
					this.attr({
						path: d
					});
					break
			}
			return this
		};
	bc.animateWith = function (e, R, b, bH, S) {
		for (var d = 0, E = X.length; d < E; d++) {
			if (X[d].el.id == e.id) {
				R.start = X[d].start
			}
		}
		return this.animate(R, b, bH, S)
	};
	bc.animateAlong = aV();
	bc.animateAlongBack = aV(1);

	function aV(b) {
		return function (i, e, d, R) {
			var E = {
				back: b
			};
			aI.is(d, "function") ? (R = d) : (E.rot = d);
			i && i.constructor == aU && (i = i.attrs.path);
			i && (E.along = i);
			return this.animate(E, e, R)
		}
	}

	function aY(bN, i, d, bM, bL, bH) {
		var bI = 3 * i,
			bK = 3 * (bM - i) - bI,
			b = 1 - bI - bK,
			S = 3 * d,
			bJ = 3 * (bL - d) - S,
			bO = 1 - S - bJ;

		function R(bP) {
			return ((b * bP + bK) * bP + bI) * bP
		}

		function e(bP, bR) {
			var bQ = E(bP, bR);
			return ((bO * bQ + bJ) * bQ + S) * bQ
		}

		function E(bP, bW) {
			var bV, bU, bS, bQ, bT, bR;
			for (bS = bP, bR = 0; bR < 8; bR++) {
				bQ = R(bS) - bP;
				if (aq(bQ) < bW) {
					return bS
				}
				bT = (3 * b * bS + 2 * bK) * bS + bI;
				if (aq(bT) < 0.000001) {
					break
				}
				bS = bS - bQ / bT
			}
			bV = 0;
			bU = 1;
			bS = bP;
			if (bS < bV) {
				return bV
			}
			if (bS > bU) {
				return bU
			}
			while (bV < bU) {
				bQ = R(bS);
				if (aq(bQ - bP) < bW) {
					return bS
				}
				if (bP > bQ) {
					bV = bS
				} else {
					bU = bS
				}
				bS = (bU - bV) / 2 + bV
			}
			return bS
		}
		return e(bN, 1 / (200 * bH))
	}
	bc.onAnimation = function (b) {
		this._run = b || 0;
		return this
	};
	bc.animate = function (b0, bQ, bP, R) {
		var d = this;
		d.timeouts = d.timeouts || [];
		if (aI.is(bP, "function") || !bP) {
			R = bP || null
		}
		if (d.removed) {
			R && R.call(d);
			return d
		}
		var bU = {},
			e = {},
			S = false,
			bL = {};
		for (var bR in b0) {
			if (b0[ag](bR)) {
				if (am[ag](bR) || d.paper.customAttributes[ag](bR)) {
					S = true;
					bU[bR] = d.attr(bR);
					(bU[bR] == null) && (bU[bR] = q[bR]);
					e[bR] = b0[bR];
					switch (am[bR]) {
						case "along":
							var bY = aK(b0[bR]);
							var bS = L(b0[bR], bY * !!b0.back);
							var bH = d.getBBox();
							bL[bR] = bY / bQ;
							bL.tx = bH.x;
							bL.ty = bH.y;
							bL.sx = bS.x;
							bL.sy = bS.y;
							e.rot = b0.rot;
							e.back = b0.back;
							e.len = bY;
							b0.rot && (bL.r = aj(d.rotate()) || 0);
							break;
						case aF:
							bL[bR] = (e[bR] - bU[bR]) / bQ;
							break;
						case "colour":
							bU[bR] = aI.getRGB(bU[bR]);
							var bT = aI.getRGB(e[bR]);
							bL[bR] = {
								r: (bT.r - bU[bR].r) / bQ,
								g: (bT.g - bU[bR].g) / bQ,
								b: (bT.b - bU[bR].b) / bQ
							};
							break;
						case "path":
							var bI = V(bU[bR], e[bR]);
							bU[bR] = bI[0];
							var bN = bI[1];
							bL[bR] = [];
							for (var bX = 0, bK = bU[bR][s]; bX < bK; bX++) {
								bL[bR][bX] = [0];
								for (var bW = 1, bZ = bU[bR][bX][s]; bW < bZ; bW++) {
									bL[bR][bX][bW] = (bN[bX][bW] - bU[bR][bX][bW]) / bQ
								}
							}
							break;
						case "csv":
							var b = bC(b0[bR])[I](a),
								bJ = bC(bU[bR])[I](a);
							switch (bR) {
								case "translation":
									bU[bR] = [0, 0];
									bL[bR] = [b[0] / bQ, b[1] / bQ];
									break;
								case "rotation":
									bU[bR] = (bJ[1] == b[1] && bJ[2] == b[2]) ? bJ : [0, b[1], b[2]];
									bL[bR] = [(b[0] - bU[bR][0]) / bQ, 0, 0];
									break;
								case "scale":
									b0[bR] = b;
									bU[bR] = bC(bU[bR])[I](a);
									bL[bR] = [(b[0] - bU[bR][0]) / bQ, (b[1] - bU[bR][1]) / bQ, 0, 0];
									break;
								case "clip-rect":
									bU[bR] = bC(bU[bR])[I](a);
									bL[bR] = [];
									bX = 4;
									while (bX--) {
										bL[bR][bX] = (b[bX] - bU[bR][bX]) / bQ
									}
									break
							}
							e[bR] = b;
							break;
						default:
							b = [].concat(b0[bR]);
							bJ = [].concat(bU[bR]);
							bL[bR] = [];
							bX = d.paper.customAttributes[bR][s];
							while (bX--) {
								bL[bR][bX] = ((b[bX] || 0) - (bJ[bX] || 0)) / bQ
							}
							break
					}
				}
			}
		}
		if (!S) {
			var bO = [],
				E;
			for (var b1 in b0) {
				if (b0[ag](b1) && bf.test(b1)) {
					bR = {
						value: b0[b1]
					};
					b1 == "from" && (b1 = 0);
					b1 == "to" && (b1 = 100);
					bR.key = T(b1, 10);
					bO.push(bR)
				}
			}
			bO.sort(bm);
			if (bO[0].key) {
				bO.unshift({
					key: 0,
					value: d.attrs
				})
			}
			for (bX = 0, bK = bO[s]; bX < bK; bX++) {
				by(bO[bX].value, d, bQ / 100 * bO[bX].key, bQ / 100 * (bO[bX - 1] && bO[bX - 1].key || 0), bO[bX - 1] && bO[bX - 1].value.callback)
			}
			E = bO[bO[s] - 1].value.callback;
			if (E) {
				d.timeouts.push(setTimeout(function () {
					E.call(d)
				}, bQ))
			}
		} else {
			var bV = aI.easing_formulas[bP];
			if (!bV) {
				bV = bC(bP).match(c);
				if (bV && bV[s] == 5) {
					var bM = bV;
					bV = function (i) {
						return aY(i, +bM[1], +bM[2], +bM[3], +bM[4], bQ)
					}
				} else {
					bV = function (i) {
						return i
					}
				}
			}
			X.push({
				start: b0.start || +new Date,
				ms: bQ,
				easing: bV,
				from: bU,
				diff: bL,
				to: e,
				el: d,
				t: {
					x: 0,
					y: 0
				}
			});
			aI.is(R, "function") && (d._ac = setTimeout(function () {
				R.call(d)
			}, bQ));
			X[s] == 1 && setTimeout(bu)
		}
		return this
	};
	bc.stop = function () {
		for (var b = 0; b < X.length; b++) {
			X[b].el.id == this.id && X.splice(b--, 1)
		}
		for (b = 0, ii = this.timeouts && this.timeouts.length; b < ii; b++) {
			clearTimeout(this.timeouts[b])
		}
		this.timeouts = [];
		clearTimeout(this._ac);
		delete this._ac;
		return this
	};
	bc.translate = function (b, d) {
		return this.attr({
			translation: b + " " + d
		})
	};
	bc[a0] = function () {
		return "Rapha\xebl\u2019s object"
	};
	aI.ae = X;
	var ah = function (b) {
		this.items = [];
		this[s] = 0;
		this.type = "set";
		if (b) {
			for (var d = 0, e = b[s]; d < e; d++) {
				if (b[d] && (b[d].constructor == aU || b[d].constructor == ah)) {
					this[this.items[s]] = this.items[this.items[s]] = b[d];
					this[s]++
				}
			}
		}
	};
	ah[bE][k] = function () {
		var E, b;
		for (var d = 0, e = arguments[s]; d < e; d++) {
			E = arguments[d];
			if (E && (E.constructor == aU || E.constructor == ah)) {
				b = this.items[s];
				this[b] = this.items[b] = E;
				this[s]++
			}
		}
		return this
	};
	ah[bE].pop = function () {
		delete this[this[s]--];
		return this.items.pop()
	};
	for (var H in bc) {
		if (bc[ag](H)) {
			ah[bE][H] = (function (b) {
				return function () {
					for (var d = 0, e = this.items[s]; d < e; d++) {
						this.items[d][b][bB](this.items[d], arguments)
					}
					return this
				}
			})(H)
		}
	}
	ah[bE].attr = function (d, S) {
		if (d && aI.is(d, a7) && aI.is(d[0], "object")) {
			for (var b = 0, R = d[s]; b < R; b++) {
				this.items[b].attr(d[b])
			}
		} else {
			for (var e = 0, E = this.items[s]; e < E; e++) {
				this.items[e].attr(d, S)
			}
		}
		return this
	};
	ah[bE].animate = function (d, b, S, bI) {
		(aI.is(S, "function") || !S) && (bI = S || null);
		var R = this.items[s],
			e = R,
			bJ, bH = this,
			E;
		bI && (E = function () {
			!--R && bI.call(bH)
		});
		S = aI.is(S, af) ? S : E;
		bJ = this.items[--e].animate(d, b, S, E);
		while (e--) {
			this.items[e] && !this.items[e].removed && this.items[e].animateWith(bJ, d, b, S, E)
		}
		return this
	};
	ah[bE].insertAfter = function (d) {
		var b = this.items[s];
		while (b--) {
			this.items[b].insertAfter(d)
		}
		return this
	};
	ah[bE].getBBox = function () {
		var b = [],
			S = [],
			d = [],
			E = [];
		for (var e = this.items[s]; e--;) {
			var R = this.items[e].getBBox();
			b[k](R.x);
			S[k](R.y);
			d[k](R.x + R.width);
			E[k](R.y + R.height)
		}
		b = bi[bB](0, b);
		S = bi[bB](0, S);
		return {
			x: b,
			y: S,
			width: m[bB](0, d) - b,
			height: m[bB](0, E) - S
		}
	};
	ah[bE].clone = function (e) {
		e = new ah;
		for (var b = 0, d = this.items[s]; b < d; b++) {
			e[k](this.items[b].clone())
		}
		return e
	};
	aI.registerFont = function (d) {
		if (!d.face) {
			return d
		}
		this.fonts = this.fonts || {};
		var i = {
				w: d.w,
				face: {},
				glyphs: {}
			},
			e = d.face["font-family"];
		for (var S in d.face) {
			if (d.face[ag](S)) {
				i.face[S] = d.face[S]
			}
		}
		if (this.fonts[e]) {
			this.fonts[e][k](i)
		} else {
			this.fonts[e] = [i]
		}
		if (!d.svg) {
			i.face["units-per-em"] = T(d.face["units-per-em"], 10);
			for (var E in d.glyphs) {
				if (d.glyphs[ag](E)) {
					var R = d.glyphs[E];
					i.glyphs[E] = {
						w: R.w,
						k: {},
						d: R.d && "M" + R.d[bs](/[mlcxtrv]/g, function (bH) {
							return {
								l: "L",
								c: "C",
								x: "z",
								t: "m",
								r: "l",
								v: "c"
							} [bH] || "M"
						}) + "z"
					};
					if (R.k) {
						for (var b in R.k) {
							if (R[ag](b)) {
								i.glyphs[E].k[b] = R.k[b]
							}
						}
					}
				}
			}
		}
		return d
	};
	aZ.getFont = function (bI, bJ, d, E) {
		E = E || "normal";
		d = d || "normal";
		bJ = +bJ || {
			normal: 400,
			bold: 700,
			lighter: 300,
			bolder: 800
		} [bJ] || 400;
		if (!aI.fonts) {
			return
		}
		var R = aI.fonts[bI];
		if (!R) {
			var e = new RegExp("(^|\\s)" + bI[bs](/[^\w\d\s+!~.:_-]/g, aP) + "(\\s|$)", "i");
			for (var b in aI.fonts) {
				if (aI.fonts[ag](b)) {
					if (e.test(b)) {
						R = aI.fonts[b];
						break
					}
				}
			}
		}
		var S;
		if (R) {
			for (var bH = 0, bK = R[s]; bH < bK; bH++) {
				S = R[bH];
				if (S.face["font-weight"] == bJ && (S.face["font-style"] == d || !S.face["font-style"]) && S.face["font-stretch"] == E) {
					break
				}
			}
		}
		return S
	};
	aZ.print = function (R, E, b, bI, bJ, bS, d) {
		bS = bS || "middle";
		d = m(bi(d || 0, 1), -1);
		var bO = this.set(),
			bR = bC(b)[I](aP),
			bP = 0,
			bM = aP,
			bT;
		aI.is(bI, b) && (bI = this.getFont(bI));
		if (bI) {
			bT = (bJ || 16) / bI.face["units-per-em"];
			var e = bI.face.bbox.split(a),
				bH = +e[0],
				bK = +e[1] + (bS == "baseline" ? e[3] - e[1] + (+bI.face.descent) : (e[3] - e[1]) / 2);
			for (var bN = 0, S = bR[s]; bN < S; bN++) {
				var bL = bN && bI.glyphs[bR[bN - 1]] || {},
					bQ = bI.glyphs[bR[bN]];
				bP += bN ? (bL.w || bI.w) + (bL.k && bL.k[bR[bN]] || 0) + (bI.w * d) : 0;
				bQ && bQ.d && bO[k](this.path(bQ.d).attr({
					fill: "#000",
					stroke: "none",
					translation: [bP, 0]
				}))
			}
			bO.scale(bT, bT, bH, bK).translate(R - bH, E - bK)
		}
		return bO
	};
	aI.format = function (d, e) {
		var b = aI.is(e, a7) ? [0][bw](e) : arguments;
		d && aI.is(d, af) && b[s] - 1 && (d = d[bs](bn, function (R, E) {
			return b[++E] == null ? aP : b[E]
		}));
		return d || aP
	};
	aI.ninja = function () {
		r.was ? (aQ.Raphael = r.is) : delete Raphael;
		return aI
	};
	aI.el = bc;
	aI.st = ah[bE];
	r.was ? (aQ.Raphael = aI) : (Raphael = aI)
})();;
! function (t, e) {
	"object" == typeof exports && "undefined" != typeof module ? module.exports = e() : "function" == typeof define && define.amd ? define(e) : t.Vue = e()
}(this, function () {
	"use strict";

	function t(t) {
		return void 0 === t || null === t
	}

	function e(t) {
		return void 0 !== t && null !== t
	}

	function n(t) {
		return !0 === t
	}

	function r(t) {
		return "string" == typeof t || "number" == typeof t || "symbol" == typeof t || "boolean" == typeof t
	}

	function i(t) {
		return null !== t && "object" == typeof t
	}

	function o(t) {
		return "[object Object]" === Nn.call(t)
	}

	function a(t) {
		var e = parseFloat(String(t));
		return e >= 0 && Math.floor(e) === e && isFinite(t)
	}

	function s(t) {
		return null == t ? "" : "object" == typeof t ? JSON.stringify(t, null, 2) : String(t)
	}

	function c(t) {
		var e = parseFloat(t);
		return isNaN(e) ? t : e
	}

	function u(t, e) {
		for (var n = Object.create(null), r = t.split(","), i = 0; i < r.length; i++) n[r[i]] = !0;
		return e ? function (t) {
			return n[t.toLowerCase()]
		} : function (t) {
			return n[t]
		}
	}

	function l(t, e) {
		if (t.length) {
			var n = t.indexOf(e);
			if (n > -1) return t.splice(n, 1)
		}
	}

	function f(t, e) {
		return Mn.call(t, e)
	}

	function p(t) {
		var e = Object.create(null);
		return function (n) {
			return e[n] || (e[n] = t(n))
		}
	}

	function d(t, e) {
		function n(n) {
			var r = arguments.length;
			return r ? r > 1 ? t.apply(e, arguments) : t.call(e, n) : t.call(e)
		}
		return n._length = t.length, n
	}

	function v(t, e) {
		e = e || 0;
		for (var n = t.length - e, r = new Array(n); n--;) r[n] = t[n + e];
		return r
	}

	function h(t, e) {
		for (var n in e) t[n] = e[n];
		return t
	}

	function m(t) {
		for (var e = {}, n = 0; n < t.length; n++) t[n] && h(e, t[n]);
		return e
	}

	function y(t, e, n) {}

	function g(t, e) {
		if (t === e) return !0;
		var n = i(t),
			r = i(e);
		if (!n || !r) return !n && !r && String(t) === String(e);
		try {
			var o = Array.isArray(t),
				a = Array.isArray(e);
			if (o && a) return t.length === e.length && t.every(function (t, n) {
				return g(t, e[n])
			});
			if (o || a) return !1;
			var s = Object.keys(t),
				c = Object.keys(e);
			return s.length === c.length && s.every(function (n) {
				return g(t[n], e[n])
			})
		} catch (t) {
			return !1
		}
	}

	function _(t, e) {
		for (var n = 0; n < t.length; n++)
			if (g(t[n], e)) return n;
		return -1
	}

	function b(t) {
		var e = !1;
		return function () {
			e || (e = !0, t.apply(this, arguments))
		}
	}

	function $(t) {
		var e = (t + "").charCodeAt(0);
		return 36 === e || 95 === e
	}

	function C(t, e, n, r) {
		Object.defineProperty(t, e, {
			value: n,
			enumerable: !!r,
			writable: !0,
			configurable: !0
		})
	}

	function w(t) {
		return "function" == typeof t && /native code/.test(t.toString())
	}

	function x(t) {
		return new mr(void 0, void 0, void 0, String(t))
	}

	function k(t, e) {
		var n = t.componentOptions,
			r = new mr(t.tag, t.data, t.children, t.text, t.elm, t.context, n, t.asyncFactory);
		return r.ns = t.ns, r.isStatic = t.isStatic, r.key = t.key, r.isComment = t.isComment, r.fnContext = t.fnContext, r.fnOptions = t.fnOptions, r.fnScopeId = t.fnScopeId, r.isCloned = !0, e && (t.children && (r.children = A(t.children, !0)), n && n.children && (n.children = A(n.children, !0))), r
	}

	function A(t, e) {
		for (var n = t.length, r = new Array(n), i = 0; i < n; i++) r[i] = k(t[i], e);
		return r
	}

	function O(t, e, n) {
		t.__proto__ = e
	}

	function S(t, e, n) {
		for (var r = 0, i = n.length; r < i; r++) {
			var o = n[r];
			C(t, o, e[o])
		}
	}

	function T(t, e) {
		if (i(t) && !(t instanceof mr)) {
			var n;
			return f(t, "__ob__") && t.__ob__ instanceof wr ? n = t.__ob__ : Cr.shouldConvert && !ur() && (Array.isArray(t) || o(t)) && Object.isExtensible(t) && !t._isVue && (n = new wr(t)), e && n && n.vmCount++, n
		}
	}

	function E(t, e, n, r, i) {
		var o = new vr,
			a = Object.getOwnPropertyDescriptor(t, e);
		if (!a || !1 !== a.configurable) {
			var s = a && a.get,
				c = a && a.set,
				u = !i && T(n);
			Object.defineProperty(t, e, {
				enumerable: !0,
				configurable: !0,
				get: function () {
					var e = s ? s.call(t) : n;
					return vr.target && (o.depend(), u && (u.dep.depend(), Array.isArray(e) && I(e))), e
				},
				set: function (e) {
					var r = s ? s.call(t) : n;
					e === r || e != e && r != r || (c ? c.call(t, e) : n = e, u = !i && T(e), o.notify())
				}
			})
		}
	}

	function j(t, e, n) {
		if (Array.isArray(t) && a(e)) return t.length = Math.max(t.length, e), t.splice(e, 1, n), n;
		if (e in t && !(e in Object.prototype)) return t[e] = n, n;
		var r = t.__ob__;
		return t._isVue || r && r.vmCount ? n : r ? (E(r.value, e, n), r.dep.notify(), n) : (t[e] = n, n)
	}

	function N(t, e) {
		if (Array.isArray(t) && a(e)) t.splice(e, 1);
		else {
			var n = t.__ob__;
			t._isVue || n && n.vmCount || f(t, e) && (delete t[e], n && n.dep.notify())
		}
	}

	function I(t) {
		for (var e = void 0, n = 0, r = t.length; n < r; n++)(e = t[n]) && e.__ob__ && e.__ob__.dep.depend(), Array.isArray(e) && I(e)
	}

	function L(t, e) {
		if (!e) return t;
		for (var n, r, i, a = Object.keys(e), s = 0; s < a.length; s++) r = t[n = a[s]], i = e[n], f(t, n) ? o(r) && o(i) && L(r, i) : j(t, n, i);
		return t
	}

	function M(t, e, n) {
		return n ? function () {
			var r = "function" == typeof e ? e.call(n, n) : e,
				i = "function" == typeof t ? t.call(n, n) : t;
			return r ? L(r, i) : i
		} : e ? t ? function () {
			return L("function" == typeof e ? e.call(this, this) : e, "function" == typeof t ? t.call(this, this) : t)
		} : e : t
	}

	function D(t, e) {
		return e ? t ? t.concat(e) : Array.isArray(e) ? e : [e] : t
	}

	function P(t, e, n, r) {
		var i = Object.create(t || null);
		return e ? h(i, e) : i
	}

	function F(t, e, n) {
		function r(r) {
			var i = xr[r] || Or;
			u[r] = i(t[r], e[r], n, r)
		}
		"function" == typeof e && (e = e.options),
			function (t, e) {
				var n = t.props;
				if (n) {
					var r, i, a = {};
					if (Array.isArray(n))
						for (r = n.length; r--;) "string" == typeof (i = n[r]) && (a[Pn(i)] = {
							type: null
						});
					else if (o(n))
						for (var s in n) i = n[s], a[Pn(s)] = o(i) ? i : {
							type: i
						};
					t.props = a
				}
			}(e),
			function (t, e) {
				var n = t.inject;
				if (n) {
					var r = t.inject = {};
					if (Array.isArray(n))
						for (var i = 0; i < n.length; i++) r[n[i]] = {
							from: n[i]
						};
					else if (o(n))
						for (var a in n) {
							var s = n[a];
							r[a] = o(s) ? h({
								from: a
							}, s) : {
								from: s
							}
						}
				}
			}(e),
			function (t) {
				var e = t.directives;
				if (e)
					for (var n in e) {
						var r = e[n];
						"function" == typeof r && (e[n] = {
							bind: r,
							update: r
						})
					}
			}(e);
		var i = e.extends;
		if (i && (t = F(t, i, n)), e.mixins)
			for (var a = 0, s = e.mixins.length; a < s; a++) t = F(t, e.mixins[a], n);
		var c, u = {};
		for (c in t) r(c);
		for (c in e) f(t, c) || r(c);
		return u
	}

	function R(t, e, n, r) {
		if ("string" == typeof n) {
			var i = t[e];
			if (f(i, n)) return i[n];
			var o = Pn(n);
			if (f(i, o)) return i[o];
			var a = Fn(o);
			if (f(i, a)) return i[a];
			return i[n] || i[o] || i[a]
		}
	}

	function H(t, e, n, r) {
		var i = e[t],
			o = !f(n, t),
			a = n[t];
		if (U(Boolean, i.type) && (o && !f(i, "default") ? a = !1 : U(String, i.type) || "" !== a && a !== Hn(t) || (a = !0)), void 0 === a) {
			a = function (t, e, n) {
				if (!f(e, "default")) return;
				var r = e.default;
				if (t && t.$options.propsData && void 0 === t.$options.propsData[n] && void 0 !== t._props[n]) return t._props[n];
				return "function" == typeof r && "Function" !== B(e.type) ? r.call(t) : r
			}(r, i, t);
			var s = Cr.shouldConvert;
			Cr.shouldConvert = !0, T(a), Cr.shouldConvert = s
		}
		return a
	}

	function B(t) {
		var e = t && t.toString().match(/^\s*function (\w+)/);
		return e ? e[1] : ""
	}

	function U(t, e) {
		if (!Array.isArray(e)) return B(e) === B(t);
		for (var n = 0, r = e.length; n < r; n++)
			if (B(e[n]) === B(t)) return !0;
		return !1
	}

	function V(t, e, n) {
		if (e)
			for (var r = e; r = r.$parent;) {
				var i = r.$options.errorCaptured;
				if (i)
					for (var o = 0; o < i.length; o++) try {
						if (!1 === i[o].call(r, t, e, n)) return
					} catch (t) {
						z(t, r, "errorCaptured hook")
					}
			}
		z(t, e, n)
	}

	function z(t, e, n) {
		if (Jn.errorHandler) try {
			return Jn.errorHandler.call(null, t, e, n)
		} catch (t) {
			K(t, null, "config.errorHandler")
		}
		K(t, e, n)
	}

	function K(t, e, n) {
		if (!Gn && !Zn || "undefined" == typeof console) throw t;
		console.error(t)
	}

	function J() {
		Tr = !1;
		var t = Sr.slice(0);
		Sr.length = 0;
		for (var e = 0; e < t.length; e++) t[e]()
	}

	function q(t, e) {
		var n;
		if (Sr.push(function () {
				if (t) try {
					t.call(e)
				} catch (t) {
					V(t, e, "nextTick")
				} else n && n(e)
			}), Tr || (Tr = !0, Er ? Ar() : kr()), !t && "undefined" != typeof Promise) return new Promise(function (t) {
			n = t
		})
	}

	function W(t) {
		G(t, Mr), Mr.clear()
	}

	function G(t, e) {
		var n, r, o = Array.isArray(t);
		if ((o || i(t)) && !Object.isFrozen(t)) {
			if (t.__ob__) {
				var a = t.__ob__.dep.id;
				if (e.has(a)) return;
				e.add(a)
			}
			if (o)
				for (n = t.length; n--;) G(t[n], e);
			else
				for (n = (r = Object.keys(t)).length; n--;) G(t[r[n]], e)
		}
	}

	function Z(t) {
		function e() {
			var t = arguments,
				n = e.fns;
			if (!Array.isArray(n)) return n.apply(null, arguments);
			for (var r = n.slice(), i = 0; i < r.length; i++) r[i].apply(null, t)
		}
		return e.fns = t, e
	}

	function X(e, n, r, i, o) {
		var a, s, c, u;
		for (a in e) s = e[a], c = n[a], u = Dr(a), t(s) || (t(c) ? (t(s.fns) && (s = e[a] = Z(s)), r(u.name, s, u.once, u.capture, u.passive, u.params)) : s !== c && (c.fns = s, e[a] = c));
		for (a in n) t(e[a]) && i((u = Dr(a)).name, n[a], u.capture)
	}

	function Y(r, i, o) {
		function a() {
			o.apply(this, arguments), l(s.fns, a)
		}
		r instanceof mr && (r = r.data.hook || (r.data.hook = {}));
		var s, c = r[i];
		t(c) ? s = Z([a]) : e(c.fns) && n(c.merged) ? (s = c).fns.push(a) : s = Z([c, a]), s.merged = !0, r[i] = s
	}

	function Q(t, n, r, i, o) {
		if (e(n)) {
			if (f(n, r)) return t[r] = n[r], o || delete n[r], !0;
			if (f(n, i)) return t[r] = n[i], o || delete n[i], !0
		}
		return !1
	}

	function tt(t) {
		return e(t) && e(t.text) && function (t) {
			return !1 === t
		}(t.isComment)
	}

	function et(i, o) {
		var a, s, c, u, l = [];
		for (a = 0; a < i.length; a++) t(s = i[a]) || "boolean" == typeof s || (u = l[c = l.length - 1], Array.isArray(s) ? s.length > 0 && (tt((s = et(s, (o || "") + "_" + a))[0]) && tt(u) && (l[c] = x(u.text + s[0].text), s.shift()), l.push.apply(l, s)) : r(s) ? tt(u) ? l[c] = x(u.text + s) : "" !== s && l.push(x(s)) : tt(s) && tt(u) ? l[c] = x(u.text + s.text) : (n(i._isVList) && e(s.tag) && t(s.key) && e(o) && (s.key = "__vlist" + o + "_" + a + "__"), l.push(s)));
		return l
	}

	function nt(t, e) {
		return (t.__esModule || fr && "Module" === t[Symbol.toStringTag]) && (t = t.default), i(t) ? e.extend(t) : t
	}

	function rt(t) {
		return t.isComment && t.asyncFactory
	}

	function it(t) {
		if (Array.isArray(t))
			for (var n = 0; n < t.length; n++) {
				var r = t[n];
				if (e(r) && (e(r.componentOptions) || rt(r))) return r
			}
	}

	function ot(t, e, n) {
		n ? Lr.$once(t, e) : Lr.$on(t, e)
	}

	function at(t, e) {
		Lr.$off(t, e)
	}

	function st(t, e, n) {
		Lr = t, X(e, n || {}, ot, at), Lr = void 0
	}

	function ct(t, e) {
		var n = {};
		if (!t) return n;
		for (var r = 0, i = t.length; r < i; r++) {
			var o = t[r],
				a = o.data;
			if (a && a.attrs && a.attrs.slot && delete a.attrs.slot, o.context !== e && o.fnContext !== e || !a || null == a.slot)(n.default || (n.default = [])).push(o);
			else {
				var s = a.slot,
					c = n[s] || (n[s] = []);
				"template" === o.tag ? c.push.apply(c, o.children || []) : c.push(o)
			}
		}
		for (var u in n) n[u].every(ut) && delete n[u];
		return n
	}

	function ut(t) {
		return t.isComment && !t.asyncFactory || " " === t.text
	}

	function lt(t, e) {
		e = e || {};
		for (var n = 0; n < t.length; n++) Array.isArray(t[n]) ? lt(t[n], e) : e[t[n].key] = t[n].fn;
		return e
	}

	function ft(t) {
		for (; t && (t = t.$parent);)
			if (t._inactive) return !0;
		return !1
	}

	function pt(t, e) {
		if (e) {
			if (t._directInactive = !1, ft(t)) return
		} else if (t._directInactive) return;
		if (t._inactive || null === t._inactive) {
			t._inactive = !1;
			for (var n = 0; n < t.$children.length; n++) pt(t.$children[n]);
			vt(t, "activated")
		}
	}

	function dt(t, e) {
		if (!(e && (t._directInactive = !0, ft(t)) || t._inactive)) {
			t._inactive = !0;
			for (var n = 0; n < t.$children.length; n++) dt(t.$children[n]);
			vt(t, "deactivated")
		}
	}

	function vt(t, e) {
		var n = t.$options[e];
		if (n)
			for (var r = 0, i = n.length; r < i; r++) try {
				n[r].call(t)
			} catch (n) {
				V(n, t, e + " hook")
			}
		t._hasHookEvent && t.$emit("hook:" + e)
	}

	function ht() {
		Ur = !0;
		var t, e;
		for (Fr.sort(function (t, e) {
				return t.id - e.id
			}), Vr = 0; Vr < Fr.length; Vr++) e = (t = Fr[Vr]).id, Hr[e] = null, t.run();
		var n = Rr.slice(),
			r = Fr.slice();
		Vr = Fr.length = Rr.length = 0, Hr = {}, Br = Ur = !1,
			function (t) {
				for (var e = 0; e < t.length; e++) t[e]._inactive = !0, pt(t[e], !0)
			}(n),
			function (t) {
				var e = t.length;
				for (; e--;) {
					var n = t[e],
						r = n.vm;
					r._watcher === n && r._isMounted && vt(r, "updated")
				}
			}(r), lr && Jn.devtools && lr.emit("flush")
	}

	function mt(t, e, n) {
		Jr.get = function () {
			return this[e][n]
		}, Jr.set = function (t) {
			this[e][n] = t
		}, Object.defineProperty(t, n, Jr)
	}

	function yt(t) {
		t._watchers = [];
		var e = t.$options;
		e.props && function (t, e) {
			var n = t.$options.propsData || {},
				r = t._props = {},
				i = t.$options._propKeys = [],
				o = !t.$parent;
			Cr.shouldConvert = o;
			var a = function (o) {
				i.push(o);
				var a = H(o, e, n, t);
				E(r, o, a), o in t || mt(t, "_props", o)
			};
			for (var s in e) a(s);
			Cr.shouldConvert = !0
		}(t, e.props), e.methods && function (t, e) {
			t.$options.props;
			for (var n in e) t[n] = null == e[n] ? y : d(e[n], t)
		}(t, e.methods), e.data ? function (t) {
			var e = t.$options.data;
			e = t._data = "function" == typeof e ? function (t, e) {
				try {
					return t.call(e, e)
				} catch (t) {
					return V(t, e, "data()"), {}
				}
			}(e, t) : e || {}, o(e) || (e = {});
			var n = Object.keys(e),
				r = t.$options.props,
				i = (t.$options.methods, n.length);
			for (; i--;) {
				var a = n[i];
				r && f(r, a) || $(a) || mt(t, "_data", a)
			}
			T(e, !0)
		}(t) : T(t._data = {}, !0), e.computed && function (t, e) {
			var n = t._computedWatchers = Object.create(null),
				r = ur();
			for (var i in e) {
				var o = e[i],
					a = "function" == typeof o ? o : o.get;
				r || (n[i] = new Kr(t, a || y, y, qr)), i in t || gt(t, i, o)
			}
		}(t, e.computed), e.watch && e.watch !== ir && function (t, e) {
			for (var n in e) {
				var r = e[n];
				if (Array.isArray(r))
					for (var i = 0; i < r.length; i++) bt(t, n, r[i]);
				else bt(t, n, r)
			}
		}(t, e.watch)
	}

	function gt(t, e, n) {
		var r = !ur();
		"function" == typeof n ? (Jr.get = r ? _t(e) : n, Jr.set = y) : (Jr.get = n.get ? r && !1 !== n.cache ? _t(e) : n.get : y, Jr.set = n.set ? n.set : y), Object.defineProperty(t, e, Jr)
	}

	function _t(t) {
		return function () {
			var e = this._computedWatchers && this._computedWatchers[t];
			if (e) return e.dirty && e.evaluate(), vr.target && e.depend(), e.value
		}
	}

	function bt(t, e, n, r) {
		return o(n) && (r = n, n = n.handler), "string" == typeof n && (n = t[n]), t.$watch(e, n, r)
	}

	function $t(t, e) {
		if (t) {
			for (var n = Object.create(null), r = fr ? Reflect.ownKeys(t).filter(function (e) {
					return Object.getOwnPropertyDescriptor(t, e).enumerable
				}) : Object.keys(t), i = 0; i < r.length; i++) {
				for (var o = r[i], a = t[o].from, s = e; s;) {
					if (s._provided && a in s._provided) {
						n[o] = s._provided[a];
						break
					}
					s = s.$parent
				}
				if (!s && "default" in t[o]) {
					var c = t[o].default;
					n[o] = "function" == typeof c ? c.call(e) : c
				}
			}
			return n
		}
	}

	function Ct(t, n) {
		var r, o, a, s, c;
		if (Array.isArray(t) || "string" == typeof t)
			for (r = new Array(t.length), o = 0, a = t.length; o < a; o++) r[o] = n(t[o], o);
		else if ("number" == typeof t)
			for (r = new Array(t), o = 0; o < t; o++) r[o] = n(o + 1, o);
		else if (i(t))
			for (s = Object.keys(t), r = new Array(s.length), o = 0, a = s.length; o < a; o++) c = s[o], r[o] = n(t[c], c, o);
		return e(r) && (r._isVList = !0), r
	}

	function wt(t, e, n, r) {
		var i, o = this.$scopedSlots[t];
		if (o) n = n || {}, r && (n = h(h({}, r), n)), i = o(n) || e;
		else {
			var a = this.$slots[t];
			a && (a._rendered = !0), i = a || e
		}
		var s = n && n.slot;
		return s ? this.$createElement("template", {
			slot: s
		}, i) : i
	}

	function xt(t) {
		return R(this.$options, "filters", t) || Un
	}

	function kt(t, e, n, r) {
		var i = Jn.keyCodes[e] || n;
		return i ? Array.isArray(i) ? -1 === i.indexOf(t) : i !== t : r ? Hn(r) !== e : void 0
	}

	function At(t, e, n, r, o) {
		if (n)
			if (i(n)) {
				Array.isArray(n) && (n = m(n));
				var a, s = function (i) {
					if ("class" === i || "style" === i || Ln(i)) a = t;
					else {
						var s = t.attrs && t.attrs.type;
						a = r || Jn.mustUseProp(e, s, i) ? t.domProps || (t.domProps = {}) : t.attrs || (t.attrs = {})
					}
					if (!(i in a) && (a[i] = n[i], o)) {
						(t.on || (t.on = {}))["update:" + i] = function (t) {
							n[i] = t
						}
					}
				};
				for (var c in n) s(c)
			} else;
		return t
	}

	function Ot(t, e) {
		var n = this._staticTrees || (this._staticTrees = []),
			r = n[t];
		return r && !e ? Array.isArray(r) ? A(r) : k(r) : (r = n[t] = this.$options.staticRenderFns[t].call(this._renderProxy, null, this), Tt(r, "__static__" + t, !1), r)
	}

	function St(t, e, n) {
		return Tt(t, "__once__" + e + (n ? "_" + n : ""), !0), t
	}

	function Tt(t, e, n) {
		if (Array.isArray(t))
			for (var r = 0; r < t.length; r++) t[r] && "string" != typeof t[r] && Et(t[r], e + "_" + r, n);
		else Et(t, e, n)
	}

	function Et(t, e, n) {
		t.isStatic = !0, t.key = e, t.isOnce = n
	}

	function jt(t, e) {
		if (e)
			if (o(e)) {
				var n = t.on = t.on ? h({}, t.on) : {};
				for (var r in e) {
					var i = n[r],
						a = e[r];
					n[r] = i ? [].concat(i, a) : a
				}
			} else;
		return t
	}

	function Nt(t) {
		t._o = St, t._n = c, t._s = s, t._l = Ct, t._t = wt, t._q = g, t._i = _, t._m = Ot, t._f = xt, t._k = kt, t._b = At, t._v = x, t._e = gr, t._u = lt, t._g = jt
	}

	function It(t, e, r, i, o) {
		var a = o.options;
		this.data = t, this.props = e, this.children = r, this.parent = i, this.listeners = t.on || jn, this.injections = $t(a.inject, i), this.slots = function () {
			return ct(r, i)
		};
		var s = Object.create(i),
			c = n(a._compiled),
			u = !c;
		c && (this.$options = a, this.$slots = this.slots(), this.$scopedSlots = t.scopedSlots || jn), a._scopeId ? this._c = function (t, e, n, r) {
			var o = Dt(s, t, e, n, r, u);
			return o && (o.fnScopeId = a._scopeId, o.fnContext = i), o
		} : this._c = function (t, e, n, r) {
			return Dt(s, t, e, n, r, u)
		}
	}

	function Lt(t, e) {
		for (var n in e) t[Pn(n)] = e[n]
	}

	function Mt(r, o, a, s, c) {
		if (!t(r)) {
			var u = a.$options._base;
			if (i(r) && (r = u.extend(r)), "function" == typeof r) {
				var l;
				if (t(r.cid) && (l = r, void 0 === (r = function (r, o, a) {
						if (n(r.error) && e(r.errorComp)) return r.errorComp;
						if (e(r.resolved)) return r.resolved;
						if (n(r.loading) && e(r.loadingComp)) return r.loadingComp;
						if (!e(r.contexts)) {
							var s = r.contexts = [a],
								c = !0,
								u = function () {
									for (var t = 0, e = s.length; t < e; t++) s[t].$forceUpdate()
								},
								l = b(function (t) {
									r.resolved = nt(t, o), c || u()
								}),
								f = b(function (t) {
									e(r.errorComp) && (r.error = !0, u())
								}),
								p = r(l, f);
							return i(p) && ("function" == typeof p.then ? t(r.resolved) && p.then(l, f) : e(p.component) && "function" == typeof p.component.then && (p.component.then(l, f), e(p.error) && (r.errorComp = nt(p.error, o)), e(p.loading) && (r.loadingComp = nt(p.loading, o), 0 === p.delay ? r.loading = !0 : setTimeout(function () {
								t(r.resolved) && t(r.error) && (r.loading = !0, u())
							}, p.delay || 200)), e(p.timeout) && setTimeout(function () {
								t(r.resolved) && f(null)
							}, p.timeout))), c = !1, r.loading ? r.loadingComp : r.resolved
						}
						r.contexts.push(a)
					}(l, u, a)))) return function (t, e, n, r, i) {
					var o = gr();
					return o.asyncFactory = t, o.asyncMeta = {
						data: e,
						context: n,
						children: r,
						tag: i
					}, o
				}(l, o, a, s, c);
				o = o || {}, Ft(r), e(o.model) && function (t, n) {
					var r = t.model && t.model.prop || "value",
						i = t.model && t.model.event || "input";
					(n.props || (n.props = {}))[r] = n.model.value;
					var o = n.on || (n.on = {});
					e(o[i]) ? o[i] = [n.model.callback].concat(o[i]) : o[i] = n.model.callback
				}(r.options, o);
				var f = function (n, r, i) {
					var o = r.options.props;
					if (!t(o)) {
						var a = {},
							s = n.attrs,
							c = n.props;
						if (e(s) || e(c))
							for (var u in o) {
								var l = Hn(u);
								Q(a, c, u, l, !0) || Q(a, s, u, l, !1)
							}
						return a
					}
				}(o, r);
				if (n(r.options.functional)) return function (t, n, r, i, o) {
					var a = t.options,
						s = {},
						c = a.props;
					if (e(c))
						for (var u in c) s[u] = H(u, c, n || jn);
					else e(r.attrs) && Lt(s, r.attrs), e(r.props) && Lt(s, r.props);
					var l = new It(r, s, o, i, t),
						f = a.render.call(null, l._c, l);
					return f instanceof mr && (f.fnContext = i, f.fnOptions = a, r.slot && ((f.data || (f.data = {})).slot = r.slot)), f
				}(r, f, o, a, s);
				var p = o.on;
				if (o.on = o.nativeOn, n(r.options.abstract)) {
					var d = o.slot;
					o = {}, d && (o.slot = d)
				}! function (t) {
					t.hook || (t.hook = {});
					for (var e = 0; e < Gr.length; e++) {
						var n = Gr[e],
							r = t.hook[n],
							i = Wr[n];
						t.hook[n] = r ? function (t, e) {
							return function (n, r, i, o) {
								t(n, r, i, o), e(n, r, i, o)
							}
						}(i, r) : i
					}
				}(o);
				var v = r.options.name || c;
				return new mr("vue-component-" + r.cid + (v ? "-" + v : ""), o, void 0, void 0, void 0, a, {
					Ctor: r,
					propsData: f,
					listeners: p,
					tag: c,
					children: s
				}, l)
			}
		}
	}

	function Dt(t, i, o, a, s, c) {
		return (Array.isArray(o) || r(o)) && (s = a, a = o, o = void 0), n(c) && (s = Xr),
			function (t, n, i, o, a) {
				if (e(i) && e(i.__ob__)) return gr();
				e(i) && e(i.is) && (n = i.is);
				if (!n) return gr();
				Array.isArray(o) && "function" == typeof o[0] && ((i = i || {}).scopedSlots = {
					default: o[0]
				}, o.length = 0);
				a === Xr ? o = function (t) {
					return r(t) ? [x(t)] : Array.isArray(t) ? et(t) : void 0
				}(o) : a === Zr && (o = function (t) {
					for (var e = 0; e < t.length; e++)
						if (Array.isArray(t[e])) return Array.prototype.concat.apply([], t);
					return t
				}(o));
				var s, c;
				if ("string" == typeof n) {
					var u;
					c = t.$vnode && t.$vnode.ns || Jn.getTagNamespace(n), s = Jn.isReservedTag(n) ? new mr(Jn.parsePlatformTagName(n), i, o, void 0, void 0, t) : e(u = R(t.$options, "components", n)) ? Mt(u, i, t, o, n) : new mr(n, i, o, void 0, void 0, t)
				} else s = Mt(n, i, t, o);
				return e(s) ? (c && Pt(s, c), s) : gr()
			}(t, i, o, a, s)
	}

	function Pt(r, i, o) {
		if (r.ns = i, "foreignObject" === r.tag && (i = void 0, o = !0), e(r.children))
			for (var a = 0, s = r.children.length; a < s; a++) {
				var c = r.children[a];
				e(c.tag) && (t(c.ns) || n(o)) && Pt(c, i, o)
			}
	}

	function Ft(t) {
		var e = t.options;
		if (t.super) {
			var n = Ft(t.super);
			if (n !== t.superOptions) {
				t.superOptions = n;
				var r = function (t) {
					var e, n = t.options,
						r = t.extendOptions,
						i = t.sealedOptions;
					for (var o in n) n[o] !== i[o] && (e || (e = {}), e[o] = function (t, e, n) {
						{
							if (Array.isArray(t)) {
								var r = [];
								n = Array.isArray(n) ? n : [n], e = Array.isArray(e) ? e : [e];
								for (var i = 0; i < t.length; i++)(e.indexOf(t[i]) >= 0 || n.indexOf(t[i]) < 0) && r.push(t[i]);
								return r
							}
							return t
						}
					}(n[o], r[o], i[o]));
					return e
				}(t);
				r && h(t.extendOptions, r), (e = t.options = F(n, t.extendOptions)).name && (e.components[e.name] = t)
			}
		}
		return e
	}

	function Rt(t) {
		this._init(t)
	}

	function Ht(t) {
		t.cid = 0;
		var e = 1;
		t.extend = function (t) {
			t = t || {};
			var n = this,
				r = n.cid,
				i = t._Ctor || (t._Ctor = {});
			if (i[r]) return i[r];
			var o = t.name || n.options.name,
				a = function (t) {
					this._init(t)
				};
			return a.prototype = Object.create(n.prototype), a.prototype.constructor = a, a.cid = e++, a.options = F(n.options, t), a.super = n, a.options.props && function (t) {
				var e = t.options.props;
				for (var n in e) mt(t.prototype, "_props", n)
			}(a), a.options.computed && function (t) {
				var e = t.options.computed;
				for (var n in e) gt(t.prototype, n, e[n])
			}(a), a.extend = n.extend, a.mixin = n.mixin, a.use = n.use, zn.forEach(function (t) {
				a[t] = n[t]
			}), o && (a.options.components[o] = a), a.superOptions = n.options, a.extendOptions = t, a.sealedOptions = h({}, a.options), i[r] = a, a
		}
	}

	function Bt(t) {
		return t && (t.Ctor.options.name || t.tag)
	}

	function Ut(t, e) {
		return Array.isArray(t) ? t.indexOf(e) > -1 : "string" == typeof t ? t.split(",").indexOf(e) > -1 : !! function (t) {
			return "[object RegExp]" === Nn.call(t)
		}(t) && t.test(e)
	}

	function Vt(t, e) {
		var n = t.cache,
			r = t.keys,
			i = t._vnode;
		for (var o in n) {
			var a = n[o];
			if (a) {
				var s = Bt(a.componentOptions);
				s && !e(s) && zt(n, o, r, i)
			}
		}
	}

	function zt(t, e, n, r) {
		var i = t[e];
		!i || r && i.tag === r.tag || i.componentInstance.$destroy(), t[e] = null, l(n, e)
	}

	function Kt(t) {
		for (var n = t.data, r = t, i = t; e(i.componentInstance);)(i = i.componentInstance._vnode) && i.data && (n = Jt(i.data, n));
		for (; e(r = r.parent);) r && r.data && (n = Jt(n, r.data));
		return function (t, n) {
			if (e(t) || e(n)) return qt(t, Wt(n));
			return ""
		}(n.staticClass, n.class)
	}

	function Jt(t, n) {
		return {
			staticClass: qt(t.staticClass, n.staticClass),
			class: e(t.class) ? [t.class, n.class] : n.class
		}
	}

	function qt(t, e) {
		return t ? e ? t + " " + e : t : e || ""
	}

	function Wt(t) {
		return Array.isArray(t) ? function (t) {
			for (var n, r = "", i = 0, o = t.length; i < o; i++) e(n = Wt(t[i])) && "" !== n && (r && (r += " "), r += n);
			return r
		}(t) : i(t) ? function (t) {
			var e = "";
			for (var n in t) t[n] && (e && (e += " "), e += n);
			return e
		}(t) : "string" == typeof t ? t : ""
	}

	function Gt(t) {
		return bi(t) ? "svg" : "math" === t ? "math" : void 0
	}

	function Zt(t) {
		if ("string" == typeof t) {
			var e = document.querySelector(t);
			return e || document.createElement("div")
		}
		return t
	}

	function Xt(t, e) {
		var n = t.data.ref;
		if (n) {
			var r = t.context,
				i = t.componentInstance || t.elm,
				o = r.$refs;
			e ? Array.isArray(o[n]) ? l(o[n], i) : o[n] === i && (o[n] = void 0) : t.data.refInFor ? Array.isArray(o[n]) ? o[n].indexOf(i) < 0 && o[n].push(i) : o[n] = [i] : o[n] = i
		}
	}

	function Yt(r, i) {
		return r.key === i.key && (r.tag === i.tag && r.isComment === i.isComment && e(r.data) === e(i.data) && function (t, n) {
			if ("input" !== t.tag) return !0;
			var r, i = e(r = t.data) && e(r = r.attrs) && r.type,
				o = e(r = n.data) && e(r = r.attrs) && r.type;
			return i === o || wi(i) && wi(o)
		}(r, i) || n(r.isAsyncPlaceholder) && r.asyncFactory === i.asyncFactory && t(i.asyncFactory.error))
	}

	function Qt(t, n, r) {
		var i, o, a = {};
		for (i = n; i <= r; ++i) e(o = t[i].key) && (a[o] = i);
		return a
	}

	function te(t, e) {
		(t.data.directives || e.data.directives) && function (t, e) {
			var n, r, i, o = t === Ai,
				a = e === Ai,
				s = ee(t.data.directives, t.context),
				c = ee(e.data.directives, e.context),
				u = [],
				l = [];
			for (n in c) r = s[n], i = c[n], r ? (i.oldValue = r.value, ne(i, "update", e, t), i.def && i.def.componentUpdated && l.push(i)) : (ne(i, "bind", e, t), i.def && i.def.inserted && u.push(i));
			if (u.length) {
				var f = function () {
					for (var n = 0; n < u.length; n++) ne(u[n], "inserted", e, t)
				};
				o ? Y(e, "insert", f) : f()
			}
			l.length && Y(e, "postpatch", function () {
				for (var n = 0; n < l.length; n++) ne(l[n], "componentUpdated", e, t)
			});
			if (!o)
				for (n in s) c[n] || ne(s[n], "unbind", t, t, a)
		}(t, e)
	}

	function ee(t, e) {
		var n = Object.create(null);
		if (!t) return n;
		var r, i;
		for (r = 0; r < t.length; r++)(i = t[r]).modifiers || (i.modifiers = Ti), n[function (t) {
			return t.rawName || t.name + "." + Object.keys(t.modifiers || {}).join(".")
		}(i)] = i, i.def = R(e.$options, "directives", i.name);
		return n
	}

	function ne(t, e, n, r, i) {
		var o = t.def && t.def[e];
		if (o) try {
			o(n.elm, t, n, r, i)
		} catch (r) {
			V(r, n.context, "directive " + t.name + " " + e + " hook")
		}
	}

	function re(n, r) {
		var i = r.componentOptions;
		if (!(e(i) && !1 === i.Ctor.options.inheritAttrs || t(n.data.attrs) && t(r.data.attrs))) {
			var o, a, s = r.elm,
				c = n.data.attrs || {},
				u = r.data.attrs || {};
			e(u.__ob__) && (u = r.data.attrs = h({}, u));
			for (o in u) a = u[o], c[o] !== a && ie(s, o, a);
			(Qn || er) && u.value !== c.value && ie(s, "value", u.value);
			for (o in c) t(u[o]) && (hi(o) ? s.removeAttributeNS(vi, mi(o)) : pi(o) || s.removeAttribute(o))
		}
	}

	function ie(t, e, n) {
		if (di(e)) yi(n) ? t.removeAttribute(e) : (n = "allowfullscreen" === e && "EMBED" === t.tagName ? "true" : e, t.setAttribute(e, n));
		else if (pi(e)) t.setAttribute(e, yi(n) || "false" === n ? "false" : "true");
		else if (hi(e)) yi(n) ? t.removeAttributeNS(vi, mi(e)) : t.setAttributeNS(vi, e, n);
		else if (yi(n)) t.removeAttribute(e);
		else {
			if (Qn && !tr && "TEXTAREA" === t.tagName && "placeholder" === e && !t.__ieph) {
				var r = function (e) {
					e.stopImmediatePropagation(), t.removeEventListener("input", r)
				};
				t.addEventListener("input", r), t.__ieph = !0
			}
			t.setAttribute(e, n)
		}
	}

	function oe(n, r) {
		var i = r.elm,
			o = r.data,
			a = n.data;
		if (!(t(o.staticClass) && t(o.class) && (t(a) || t(a.staticClass) && t(a.class)))) {
			var s = Kt(r),
				c = i._transitionClasses;
			e(c) && (s = qt(s, Wt(c))), s !== i._prevClass && (i.setAttribute("class", s), i._prevClass = s)
		}
	}

	function ae(t) {
		function e() {
			(a || (a = [])).push(t.slice(v, i).trim()), v = i + 1
		}
		var n, r, i, o, a, s = !1,
			c = !1,
			u = !1,
			l = !1,
			f = 0,
			p = 0,
			d = 0,
			v = 0;
		for (i = 0; i < t.length; i++)
			if (r = n, n = t.charCodeAt(i), s) 39 === n && 92 !== r && (s = !1);
			else if (c) 34 === n && 92 !== r && (c = !1);
		else if (u) 96 === n && 92 !== r && (u = !1);
		else if (l) 47 === n && 92 !== r && (l = !1);
		else if (124 !== n || 124 === t.charCodeAt(i + 1) || 124 === t.charCodeAt(i - 1) || f || p || d) {
			switch (n) {
				case 34:
					c = !0;
					break;
				case 39:
					s = !0;
					break;
				case 96:
					u = !0;
					break;
				case 40:
					d++;
					break;
				case 41:
					d--;
					break;
				case 91:
					p++;
					break;
				case 93:
					p--;
					break;
				case 123:
					f++;
					break;
				case 125:
					f--
			}
			if (47 === n) {
				for (var h = i - 1, m = void 0; h >= 0 && " " === (m = t.charAt(h)); h--);
				m && Ii.test(m) || (l = !0)
			}
		} else void 0 === o ? (v = i + 1, o = t.slice(0, i).trim()) : e();
		if (void 0 === o ? o = t.slice(0, i).trim() : 0 !== v && e(), a)
			for (i = 0; i < a.length; i++) o = function (t, e) {
				var n = e.indexOf("("); {
					if (n < 0) return '_f("' + e + '")(' + t + ")";
					var r = e.slice(0, n),
						i = e.slice(n + 1);
					return '_f("' + r + '")(' + t + "," + i
				}
			}(o, a[i]);
		return o
	}

	function se(t) {
		console.error("[Vue compiler]: " + t)
	}

	function ce(t, e) {
		return t ? t.map(function (t) {
			return t[e]
		}).filter(function (t) {
			return t
		}) : []
	}

	function ue(t, e, n) {
		(t.props || (t.props = [])).push({
			name: e,
			value: n
		}), t.plain = !1
	}

	function le(t, e, n) {
		(t.attrs || (t.attrs = [])).push({
			name: e,
			value: n
		}), t.plain = !1
	}

	function fe(t, e, n) {
		t.attrsMap[e] = n, t.attrsList.push({
			name: e,
			value: n
		})
	}

	function pe(t, e, n, r, i, o) {
		(t.directives || (t.directives = [])).push({
			name: e,
			rawName: n,
			value: r,
			arg: i,
			modifiers: o
		}), t.plain = !1
	}

	function de(t, e, n, r, i, o) {
		(r = r || jn).capture && (delete r.capture, e = "!" + e), r.once && (delete r.once, e = "~" + e), r.passive && (delete r.passive, e = "&" + e), "click" === e && (r.right ? (e = "contextmenu", delete r.right) : r.middle && (e = "mouseup"));
		var a;
		r.native ? (delete r.native, a = t.nativeEvents || (t.nativeEvents = {})) : a = t.events || (t.events = {});
		var s = {
			value: n
		};
		r !== jn && (s.modifiers = r);
		var c = a[e];
		Array.isArray(c) ? i ? c.unshift(s) : c.push(s) : a[e] = c ? i ? [s, c] : [c, s] : s, t.plain = !1
	}

	function ve(t, e, n) {
		var r = he(t, ":" + e) || he(t, "v-bind:" + e);
		if (null != r) return ae(r);
		if (!1 !== n) {
			var i = he(t, e);
			if (null != i) return JSON.stringify(i)
		}
	}

	function he(t, e, n) {
		var r;
		if (null != (r = t.attrsMap[e]))
			for (var i = t.attrsList, o = 0, a = i.length; o < a; o++)
				if (i[o].name === e) {
					i.splice(o, 1);
					break
				}
		return n && delete t.attrsMap[e], r
	}

	function me(t, e, n) {
		var r = n || {},
			i = "$$v";
		r.trim && (i = "(typeof $$v === 'string'? $$v.trim(): $$v)"), r.number && (i = "_n(" + i + ")");
		var o = ye(e, i);
		t.model = {
			value: "(" + e + ")",
			expression: '"' + e + '"',
			callback: "function ($$v) {" + o + "}"
		}
	}

	function ye(t, e) {
		var n = function (t) {
			if (ei = t.length, t.indexOf("[") < 0 || t.lastIndexOf("]") < ei - 1) return (ii = t.lastIndexOf(".")) > -1 ? {
				exp: t.slice(0, ii),
				key: '"' + t.slice(ii + 1) + '"'
			} : {
				exp: t,
				key: null
			};
			ni = t, ii = oi = ai = 0;
			for (; !_e();) be(ri = ge()) ? $e(ri) : 91 === ri && function (t) {
				var e = 1;
				oi = ii;
				for (; !_e();)
					if (t = ge(), be(t)) $e(t);
					else if (91 === t && e++, 93 === t && e--, 0 === e) {
					ai = ii;
					break
				}
			}(ri);
			return {
				exp: t.slice(0, oi),
				key: t.slice(oi + 1, ai)
			}
		}(t);
		return null === n.key ? t + "=" + e : "$set(" + n.exp + ", " + n.key + ", " + e + ")"
	}

	function ge() {
		return ni.charCodeAt(++ii)
	}

	function _e() {
		return ii >= ei
	}

	function be(t) {
		return 34 === t || 39 === t
	}

	function $e(t) {
		for (var e = t; !_e() && (t = ge()) !== e;);
	}

	function Ce(t, e, n, r, i) {
		e = function (t) {
			return t._withTask || (t._withTask = function () {
				Er = !0;
				var e = t.apply(null, arguments);
				return Er = !1, e
			})
		}(e), n && (e = function (t, e, n) {
			var r = si;
			return function i() {
				null !== t.apply(null, arguments) && we(e, i, n, r)
			}
		}(e, t, r)), si.addEventListener(t, e, or ? {
			capture: r,
			passive: i
		} : r)
	}

	function we(t, e, n, r) {
		(r || si).removeEventListener(t, e._withTask || e, n)
	}

	function xe(n, r) {
		if (!t(n.data.on) || !t(r.data.on)) {
			var i = r.data.on || {},
				o = n.data.on || {};
			si = r.elm,
				function (t) {
					if (e(t[Li])) {
						var n = Qn ? "change" : "input";
						t[n] = [].concat(t[Li], t[n] || []), delete t[Li]
					}
					e(t[Mi]) && (t.change = [].concat(t[Mi], t.change || []), delete t[Mi])
				}(i), X(i, o, Ce, we, r.context), si = void 0
		}
	}

	function ke(n, r) {
		if (!t(n.data.domProps) || !t(r.data.domProps)) {
			var i, o, a = r.elm,
				s = n.data.domProps || {},
				u = r.data.domProps || {};
			e(u.__ob__) && (u = r.data.domProps = h({}, u));
			for (i in s) t(u[i]) && (a[i] = "");
			for (i in u) {
				if (o = u[i], "textContent" === i || "innerHTML" === i) {
					if (r.children && (r.children.length = 0), o === s[i]) continue;
					1 === a.childNodes.length && a.removeChild(a.childNodes[0])
				}
				if ("value" === i) {
					a._value = o;
					var l = t(o) ? "" : String(o);
					(function (t, n) {
						return !t.composing && ("OPTION" === t.tagName || function (t, e) {
							var n = !0;
							try {
								n = document.activeElement !== t
							} catch (t) {}
							return n && t.value !== e
						}(t, n) || function (t, n) {
							var r = t.value,
								i = t._vModifiers;
							if (e(i)) {
								if (i.lazy) return !1;
								if (i.number) return c(r) !== c(n);
								if (i.trim) return r.trim() !== n.trim()
							}
							return r !== n
						}(t, n))
					})(a, l) && (a.value = l)
				} else a[i] = o
			}
		}
	}

	function Ae(t) {
		var e = Oe(t.style);
		return t.staticStyle ? h(t.staticStyle, e) : e
	}

	function Oe(t) {
		return Array.isArray(t) ? m(t) : "string" == typeof t ? Fi(t) : t
	}

	function Se(n, r) {
		var i = r.data,
			o = n.data;
		if (!(t(i.staticStyle) && t(i.style) && t(o.staticStyle) && t(o.style))) {
			var a, s, c = r.elm,
				u = o.staticStyle,
				l = o.normalizedStyle || o.style || {},
				f = u || l,
				p = Oe(r.data.style) || {};
			r.data.normalizedStyle = e(p.__ob__) ? h({}, p) : p;
			var d = function (t, e) {
				var n, r = {};
				if (e)
					for (var i = t; i.componentInstance;)(i = i.componentInstance._vnode) && i.data && (n = Ae(i.data)) && h(r, n);
				(n = Ae(t.data)) && h(r, n);
				for (var o = t; o = o.parent;) o.data && (n = Ae(o.data)) && h(r, n);
				return r
			}(r, !0);
			for (s in f) t(d[s]) && Bi(c, s, "");
			for (s in d)(a = d[s]) !== f[s] && Bi(c, s, null == a ? "" : a)
		}
	}

	function Te(t, e) {
		if (e && (e = e.trim()))
			if (t.classList) e.indexOf(" ") > -1 ? e.split(/\s+/).forEach(function (e) {
				return t.classList.add(e)
			}) : t.classList.add(e);
			else {
				var n = " " + (t.getAttribute("class") || "") + " ";
				n.indexOf(" " + e + " ") < 0 && t.setAttribute("class", (n + e).trim())
			}
	}

	function Ee(t, e) {
		if (e && (e = e.trim()))
			if (t.classList) e.indexOf(" ") > -1 ? e.split(/\s+/).forEach(function (e) {
				return t.classList.remove(e)
			}) : t.classList.remove(e), t.classList.length || t.removeAttribute("class");
			else {
				for (var n = " " + (t.getAttribute("class") || "") + " ", r = " " + e + " "; n.indexOf(r) >= 0;) n = n.replace(r, " ");
				(n = n.trim()) ? t.setAttribute("class", n): t.removeAttribute("class")
			}
	}

	function je(t) {
		if (t) {
			if ("object" == typeof t) {
				var e = {};
				return !1 !== t.css && h(e, Ki(t.name || "v")), h(e, t), e
			}
			return "string" == typeof t ? Ki(t) : void 0
		}
	}

	function Ne(t) {
		Qi(function () {
			Qi(t)
		})
	}

	function Ie(t, e) {
		var n = t._transitionClasses || (t._transitionClasses = []);
		n.indexOf(e) < 0 && (n.push(e), Te(t, e))
	}

	function Le(t, e) {
		t._transitionClasses && l(t._transitionClasses, e), Ee(t, e)
	}

	function Me(t, e, n) {
		var r = De(t, e),
			i = r.type,
			o = r.timeout,
			a = r.propCount;
		if (!i) return n();
		var s = i === qi ? Zi : Yi,
			c = 0,
			u = function () {
				t.removeEventListener(s, l), n()
			},
			l = function (e) {
				e.target === t && ++c >= a && u()
			};
		setTimeout(function () {
			c < a && u()
		}, o + 1), t.addEventListener(s, l)
	}

	function De(t, e) {
		var n, r = window.getComputedStyle(t),
			i = r[Gi + "Delay"].split(", "),
			o = r[Gi + "Duration"].split(", "),
			a = Pe(i, o),
			s = r[Xi + "Delay"].split(", "),
			c = r[Xi + "Duration"].split(", "),
			u = Pe(s, c),
			l = 0,
			f = 0;
		e === qi ? a > 0 && (n = qi, l = a, f = o.length) : e === Wi ? u > 0 && (n = Wi, l = u, f = c.length) : f = (n = (l = Math.max(a, u)) > 0 ? a > u ? qi : Wi : null) ? n === qi ? o.length : c.length : 0;
		return {
			type: n,
			timeout: l,
			propCount: f,
			hasTransform: n === qi && to.test(r[Gi + "Property"])
		}
	}

	function Pe(t, e) {
		for (; t.length < e.length;) t = t.concat(t);
		return Math.max.apply(null, e.map(function (e, n) {
			return Fe(e) + Fe(t[n])
		}))
	}

	function Fe(t) {
		return 1e3 * Number(t.slice(0, -1))
	}

	function Re(n, r) {
		var o = n.elm;
		e(o._leaveCb) && (o._leaveCb.cancelled = !0, o._leaveCb());
		var a = je(n.data.transition);
		if (!t(a) && !e(o._enterCb) && 1 === o.nodeType) {
			for (var s = a.css, u = a.type, l = a.enterClass, f = a.enterToClass, p = a.enterActiveClass, d = a.appearClass, v = a.appearToClass, h = a.appearActiveClass, m = a.beforeEnter, y = a.enter, g = a.afterEnter, _ = a.enterCancelled, $ = a.beforeAppear, C = a.appear, w = a.afterAppear, x = a.appearCancelled, k = a.duration, A = Pr, O = Pr.$vnode; O && O.parent;) A = (O = O.parent).context;
			var S = !A._isMounted || !n.isRootInsert;
			if (!S || C || "" === C) {
				var T = S && d ? d : l,
					E = S && h ? h : p,
					j = S && v ? v : f,
					N = S ? $ || m : m,
					I = S && "function" == typeof C ? C : y,
					L = S ? w || g : g,
					M = S ? x || _ : _,
					D = c(i(k) ? k.enter : k),
					P = !1 !== s && !tr,
					F = Ue(I),
					R = o._enterCb = b(function () {
						P && (Le(o, j), Le(o, E)), R.cancelled ? (P && Le(o, T), M && M(o)) : L && L(o), o._enterCb = null
					});
				n.data.show || Y(n, "insert", function () {
					var t = o.parentNode,
						e = t && t._pending && t._pending[n.key];
					e && e.tag === n.tag && e.elm._leaveCb && e.elm._leaveCb(), I && I(o, R)
				}), N && N(o), P && (Ie(o, T), Ie(o, E), Ne(function () {
					Ie(o, j), Le(o, T), R.cancelled || F || (Be(D) ? setTimeout(R, D) : Me(o, u, R))
				})), n.data.show && (r && r(), I && I(o, R)), P || F || R()
			}
		}
	}

	function He(n, r) {
		function o() {
			x.cancelled || (n.data.show || ((a.parentNode._pending || (a.parentNode._pending = {}))[n.key] = n), v && v(a), $ && (Ie(a, f), Ie(a, d), Ne(function () {
				Ie(a, p), Le(a, f), x.cancelled || C || (Be(w) ? setTimeout(x, w) : Me(a, l, x))
			})), h && h(a, x), $ || C || x())
		}
		var a = n.elm;
		e(a._enterCb) && (a._enterCb.cancelled = !0, a._enterCb());
		var s = je(n.data.transition);
		if (t(s) || 1 !== a.nodeType) return r();
		if (!e(a._leaveCb)) {
			var u = s.css,
				l = s.type,
				f = s.leaveClass,
				p = s.leaveToClass,
				d = s.leaveActiveClass,
				v = s.beforeLeave,
				h = s.leave,
				m = s.afterLeave,
				y = s.leaveCancelled,
				g = s.delayLeave,
				_ = s.duration,
				$ = !1 !== u && !tr,
				C = Ue(h),
				w = c(i(_) ? _.leave : _),
				x = a._leaveCb = b(function () {
					a.parentNode && a.parentNode._pending && (a.parentNode._pending[n.key] = null), $ && (Le(a, p), Le(a, d)), x.cancelled ? ($ && Le(a, f), y && y(a)) : (r(), m && m(a)), a._leaveCb = null
				});
			g ? g(o) : o()
		}
	}

	function Be(t) {
		return "number" == typeof t && !isNaN(t)
	}

	function Ue(n) {
		if (t(n)) return !1;
		var r = n.fns;
		return e(r) ? Ue(Array.isArray(r) ? r[0] : r) : (n._length || n.length) > 1
	}

	function Ve(t, e) {
		!0 !== e.data.show && Re(e)
	}

	function ze(t, e, n) {
		Ke(t, e, n), (Qn || er) && setTimeout(function () {
			Ke(t, e, n)
		}, 0)
	}

	function Ke(t, e, n) {
		var r = e.value,
			i = t.multiple;
		if (!i || Array.isArray(r)) {
			for (var o, a, s = 0, c = t.options.length; s < c; s++)
				if (a = t.options[s], i) o = _(r, qe(a)) > -1, a.selected !== o && (a.selected = o);
				else if (g(qe(a), r)) return void(t.selectedIndex !== s && (t.selectedIndex = s));
			i || (t.selectedIndex = -1)
		}
	}

	function Je(t, e) {
		return e.every(function (e) {
			return !g(e, t)
		})
	}

	function qe(t) {
		return "_value" in t ? t._value : t.value
	}

	function We(t) {
		t.target.composing = !0
	}

	function Ge(t) {
		t.target.composing && (t.target.composing = !1, Ze(t.target, "input"))
	}

	function Ze(t, e) {
		var n = document.createEvent("HTMLEvents");
		n.initEvent(e, !0, !0), t.dispatchEvent(n)
	}

	function Xe(t) {
		return !t.componentInstance || t.data && t.data.transition ? t : Xe(t.componentInstance._vnode)
	}

	function Ye(t) {
		var e = t && t.componentOptions;
		return e && e.Ctor.options.abstract ? Ye(it(e.children)) : t
	}

	function Qe(t) {
		var e = {},
			n = t.$options;
		for (var r in n.propsData) e[r] = t[r];
		var i = n._parentListeners;
		for (var o in i) e[Pn(o)] = i[o];
		return e
	}

	function tn(t, e) {
		if (/\d-keep-alive$/.test(e.tag)) return t("keep-alive", {
			props: e.componentOptions.propsData
		})
	}

	function en(t) {
		t.elm._moveCb && t.elm._moveCb(), t.elm._enterCb && t.elm._enterCb()
	}

	function nn(t) {
		t.data.newPos = t.elm.getBoundingClientRect()
	}

	function rn(t) {
		var e = t.data.pos,
			n = t.data.newPos,
			r = e.left - n.left,
			i = e.top - n.top;
		if (r || i) {
			t.data.moved = !0;
			var o = t.elm.style;
			o.transform = o.WebkitTransform = "translate(" + r + "px," + i + "px)", o.transitionDuration = "0s"
		}
	}

	function on(t, e) {
		var n = e ? zo : Vo;
		return t.replace(n, function (t) {
			return Uo[t]
		})
	}

	function an(t, e, n) {
		return {
			type: 1,
			tag: t,
			attrsList: e,
			attrsMap: function (t) {
				for (var e = {}, n = 0, r = t.length; n < r; n++) e[t[n].name] = t[n].value;
				return e
			}(e),
			parent: n,
			children: []
		}
	}

	function sn(t, e) {
		function n(t) {
			t.pre && (s = !1), Lo(t.tag) && (c = !1);
			for (var n = 0; n < Io.length; n++) Io[n](t, e)
		}
		To = e.warn || se, Lo = e.isPreTag || Bn, Mo = e.mustUseProp || Bn, Do = e.getTagNamespace || Bn, jo = ce(e.modules, "transformNode"), No = ce(e.modules, "preTransformNode"), Io = ce(e.modules, "postTransformNode"), Eo = e.delimiters;
		var r, i, o = [],
			a = !1 !== e.preserveWhitespace,
			s = !1,
			c = !1;
		return function (t, e) {
			function n(e) {
				l += e, t = t.substring(e)
			}

			function r(t, n, r) {
				var i, s;
				if (null == n && (n = l), null == r && (r = l), t && (s = t.toLowerCase()), t)
					for (i = a.length - 1; i >= 0 && a[i].lowerCasedTag !== s; i--);
				else i = 0;
				if (i >= 0) {
					for (var c = a.length - 1; c >= i; c--) e.end && e.end(a[c].tag, n, r);
					a.length = i, o = i && a[i - 1].tag
				} else "br" === s ? e.start && e.start(t, [], !0, n, r) : "p" === s && (e.start && e.start(t, [], !1, n, r), e.end && e.end(t, n, r))
			}
			for (var i, o, a = [], s = e.expectHTML, c = e.isUnaryTag || Bn, u = e.canBeLeftOpenTag || Bn, l = 0; t;) {
				if (i = t, o && Ho(o)) {
					var f = 0,
						p = o.toLowerCase(),
						d = Bo[p] || (Bo[p] = new RegExp("([\\s\\S]*?)(</" + p + "[^>]*>)", "i")),
						v = t.replace(d, function (t, n, r) {
							return f = r.length, Ho(p) || "noscript" === p || (n = n.replace(/<!--([\s\S]*?)-->/g, "$1").replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1")), Jo(p, n) && (n = n.slice(1)), e.chars && e.chars(n), ""
						});
					l += t.length - v.length, t = v, r(p, l - f, l)
				} else {
					var h = t.indexOf("<");
					if (0 === h) {
						if (Ao.test(t)) {
							var m = t.indexOf("--\x3e");
							if (m >= 0) {
								e.shouldKeepComment && e.comment(t.substring(4, m)), n(m + 3);
								continue
							}
						}
						if (Oo.test(t)) {
							var y = t.indexOf("]>");
							if (y >= 0) {
								n(y + 2);
								continue
							}
						}
						var g = t.match(ko);
						if (g) {
							n(g[0].length);
							continue
						}
						var _ = t.match(xo);
						if (_) {
							var b = l;
							n(_[0].length), r(_[1], b, l);
							continue
						}
						var $ = function () {
							var e = t.match(Co);
							if (e) {
								var r = {
									tagName: e[1],
									attrs: [],
									start: l
								};
								n(e[0].length);
								for (var i, o; !(i = t.match(wo)) && (o = t.match(_o));) n(o[0].length), r.attrs.push(o);
								if (i) return r.unarySlash = i[1], n(i[0].length), r.end = l, r
							}
						}();
						if ($) {
							! function (t) {
								var n = t.tagName,
									i = t.unarySlash;
								s && ("p" === o && go(n) && r(o), u(n) && o === n && r(n));
								for (var l = c(n) || !!i, f = t.attrs.length, p = new Array(f), d = 0; d < f; d++) {
									var v = t.attrs[d];
									So && -1 === v[0].indexOf('""') && ("" === v[3] && delete v[3], "" === v[4] && delete v[4], "" === v[5] && delete v[5]);
									var h = v[3] || v[4] || v[5] || "",
										m = "a" === n && "href" === v[1] ? e.shouldDecodeNewlinesForHref : e.shouldDecodeNewlines;
									p[d] = {
										name: v[1],
										value: on(h, m)
									}
								}
								l || (a.push({
									tag: n,
									lowerCasedTag: n.toLowerCase(),
									attrs: p
								}), o = n), e.start && e.start(n, p, l, t.start, t.end)
							}($), Jo(o, t) && n(1);
							continue
						}
					}
					var C = void 0,
						w = void 0,
						x = void 0;
					if (h >= 0) {
						for (w = t.slice(h); !(xo.test(w) || Co.test(w) || Ao.test(w) || Oo.test(w) || (x = w.indexOf("<", 1)) < 0);) h += x, w = t.slice(h);
						C = t.substring(0, h), n(h)
					}
					h < 0 && (C = t, t = ""), e.chars && C && e.chars(C)
				}
				if (t === i) {
					e.chars && e.chars(t);
					break
				}
			}
			r()
		}(t, {
			warn: To,
			expectHTML: e.expectHTML,
			isUnaryTag: e.isUnaryTag,
			canBeLeftOpenTag: e.canBeLeftOpenTag,
			shouldDecodeNewlines: e.shouldDecodeNewlines,
			shouldDecodeNewlinesForHref: e.shouldDecodeNewlinesForHref,
			shouldKeepComment: e.comments,
			start: function (t, a, u) {
				var l = i && i.ns || Do(t);
				Qn && "svg" === l && (a = function (t) {
					for (var e = [], n = 0; n < t.length; n++) {
						var r = t[n];
						na.test(r.name) || (r.name = r.name.replace(ra, ""), e.push(r))
					}
					return e
				}(a));
				var f = an(t, a, i);
				l && (f.ns = l),
					function (t) {
						return "style" === t.tag || "script" === t.tag && (!t.attrsMap.type || "text/javascript" === t.attrsMap.type)
					}(f) && !ur() && (f.forbidden = !0);
				for (var p = 0; p < No.length; p++) f = No[p](f, e) || f;
				if (s || (! function (t) {
						null != he(t, "v-pre") && (t.pre = !0)
					}(f), f.pre && (s = !0)), Lo(f.tag) && (c = !0), s ? function (t) {
						var e = t.attrsList.length;
						if (e)
							for (var n = t.attrs = new Array(e), r = 0; r < e; r++) n[r] = {
								name: t.attrsList[r].name,
								value: JSON.stringify(t.attrsList[r].value)
							};
						else t.pre || (t.plain = !0)
					}(f) : f.processed || (un(f), function (t) {
						var e = he(t, "v-if");
						if (e) t.if = e, ln(t, {
							exp: e,
							block: t
						});
						else {
							null != he(t, "v-else") && (t.else = !0);
							var n = he(t, "v-else-if");
							n && (t.elseif = n)
						}
					}(f), function (t) {
						null != he(t, "v-once") && (t.once = !0)
					}(f), cn(f, e)), r ? o.length || r.if && (f.elseif || f.else) && ln(r, {
						exp: f.elseif,
						block: f
					}) : r = f, i && !f.forbidden)
					if (f.elseif || f.else) ! function (t, e) {
						var n = function (t) {
							var e = t.length;
							for (; e--;) {
								if (1 === t[e].type) return t[e];
								t.pop()
							}
						}(e.children);
						n && n.if && ln(n, {
							exp: t.elseif,
							block: t
						})
					}(f, i);
					else if (f.slotScope) {
					i.plain = !1;
					var d = f.slotTarget || '"default"';
					(i.scopedSlots || (i.scopedSlots = {}))[d] = f
				} else i.children.push(f), f.parent = i;
				u ? n(f) : (i = f, o.push(f))
			},
			end: function () {
				var t = o[o.length - 1],
					e = t.children[t.children.length - 1];
				e && 3 === e.type && " " === e.text && !c && t.children.pop(), o.length -= 1, i = o[o.length - 1], n(t)
			},
			chars: function (t) {
				if (i && (!Qn || "textarea" !== i.tag || i.attrsMap.placeholder !== t)) {
					var e = i.children;
					if (t = c || t.trim() ? function (t) {
							return "script" === t.tag || "style" === t.tag
						}(i) ? t : ea(t) : a && e.length ? " " : "") {
						var n;
						!s && " " !== t && (n = function (t, e) {
							var n = e ? fo(e) : uo;
							if (n.test(t)) {
								for (var r, i, o, a = [], s = [], c = n.lastIndex = 0; r = n.exec(t);) {
									(i = r.index) > c && (s.push(o = t.slice(c, i)), a.push(JSON.stringify(o)));
									var u = ae(r[1].trim());
									a.push("_s(" + u + ")"), s.push({
										"@binding": u
									}), c = i + r[0].length
								}
								return c < t.length && (s.push(o = t.slice(c)), a.push(JSON.stringify(o))), {
									expression: a.join("+"),
									tokens: s
								}
							}
						}(t, Eo)) ? e.push({
							type: 2,
							expression: n.expression,
							tokens: n.tokens,
							text: t
						}) : " " === t && e.length && " " === e[e.length - 1].text || e.push({
							type: 3,
							text: t
						})
					}
				}
			},
			comment: function (t) {
				i.children.push({
					type: 3,
					text: t,
					isComment: !0
				})
			}
		}), r
	}

	function cn(t, e) {
		! function (t) {
			var e = ve(t, "key");
			e && (t.key = e)
		}(t), t.plain = !t.key && !t.attrsList.length,
			function (t) {
				var e = ve(t, "ref");
				e && (t.ref = e, t.refInFor = function (t) {
					var e = t;
					for (; e;) {
						if (void 0 !== e.for) return !0;
						e = e.parent
					}
					return !1
				}(t))
			}(t),
			function (t) {
				if ("slot" === t.tag) t.slotName = ve(t, "name");
				else {
					var e;
					"template" === t.tag ? (e = he(t, "scope"), t.slotScope = e || he(t, "slot-scope")) : (e = he(t, "slot-scope")) && (t.slotScope = e);
					var n = ve(t, "slot");
					n && (t.slotTarget = '""' === n ? '"default"' : n, "template" === t.tag || t.slotScope || le(t, "slot", n))
				}
			}(t),
			function (t) {
				var e;
				(e = ve(t, "is")) && (t.component = e);
				null != he(t, "inline-template") && (t.inlineTemplate = !0)
			}(t);
		for (var n = 0; n < jo.length; n++) t = jo[n](t, e) || t;
		! function (t) {
			var e, n, r, i, o, a, s, c = t.attrsList;
			for (e = 0, n = c.length; e < n; e++)
				if (r = i = c[e].name, o = c[e].value, Wo.test(r))
					if (t.hasBindings = !0, (a = function (t) {
							var e = t.match(ta);
							if (e) {
								var n = {};
								return e.forEach(function (t) {
									n[t.slice(1)] = !0
								}), n
							}
						}(r)) && (r = r.replace(ta, "")), Qo.test(r)) r = r.replace(Qo, ""), o = ae(o), s = !1, a && (a.prop && (s = !0, "innerHtml" === (r = Pn(r)) && (r = "innerHTML")), a.camel && (r = Pn(r)), a.sync && de(t, "update:" + Pn(r), ye(o, "$event"))), s || !t.component && Mo(t.tag, t.attrsMap.type, r) ? ue(t, r, o) : le(t, r, o);
					else if (qo.test(r)) r = r.replace(qo, ""), de(t, r, o, a, !1);
			else {
				var u = (r = r.replace(Wo, "")).match(Yo),
					l = u && u[1];
				l && (r = r.slice(0, -(l.length + 1))), pe(t, r, i, o, l, a)
			} else le(t, r, JSON.stringify(o)), !t.component && "muted" === r && Mo(t.tag, t.attrsMap.type, r) && ue(t, r, "true")
		}(t)
	}

	function un(t) {
		var e;
		if (e = he(t, "v-for")) {
			var n = function (t) {
				var e = t.match(Go);
				if (!e) return;
				var n = {};
				n.for = e[2].trim();
				var r = e[1].trim().replace(Xo, ""),
					i = r.match(Zo);
				i ? (n.alias = r.replace(Zo, ""), n.iterator1 = i[1].trim(), i[2] && (n.iterator2 = i[2].trim())) : n.alias = r;
				return n
			}(e);
			n && h(t, n)
		}
	}

	function ln(t, e) {
		t.ifConditions || (t.ifConditions = []), t.ifConditions.push(e)
	}

	function fn(t) {
		return an(t.tag, t.attrsList.slice(), t.parent)
	}

	function pn(t) {
		if (t.static = function (t) {
				if (2 === t.type) return !1;
				if (3 === t.type) return !0;
				return !(!t.pre && (t.hasBindings || t.if || t.for || In(t.tag) || !Fo(t.tag) || function (t) {
					for (; t.parent;) {
						if ("template" !== (t = t.parent).tag) return !1;
						if (t.for) return !0
					}
					return !1
				}(t) || !Object.keys(t).every(Po)))
			}(t), 1 === t.type) {
			if (!Fo(t.tag) && "slot" !== t.tag && null == t.attrsMap["inline-template"]) return;
			for (var e = 0, n = t.children.length; e < n; e++) {
				var r = t.children[e];
				pn(r), r.static || (t.static = !1)
			}
			if (t.ifConditions)
				for (var i = 1, o = t.ifConditions.length; i < o; i++) {
					var a = t.ifConditions[i].block;
					pn(a), a.static || (t.static = !1)
				}
		}
	}

	function dn(t, e) {
		if (1 === t.type) {
			if ((t.static || t.once) && (t.staticInFor = e), t.static && t.children.length && (1 !== t.children.length || 3 !== t.children[0].type)) return void(t.staticRoot = !0);
			if (t.staticRoot = !1, t.children)
				for (var n = 0, r = t.children.length; n < r; n++) dn(t.children[n], e || !!t.for);
			if (t.ifConditions)
				for (var i = 1, o = t.ifConditions.length; i < o; i++) dn(t.ifConditions[i].block, e)
		}
	}

	function vn(t, e, n) {
		var r = e ? "nativeOn:{" : "on:{";
		for (var i in t) r += '"' + i + '":' + hn(i, t[i]) + ",";
		return r.slice(0, -1) + "}"
	}

	function hn(t, e) {
		if (!e) return "function(){}";
		if (Array.isArray(e)) return "[" + e.map(function (e) {
			return hn(t, e)
		}).join(",") + "]";
		var n = ca.test(e.value),
			r = sa.test(e.value);
		if (e.modifiers) {
			var i = "",
				o = "",
				a = [];
			for (var s in e.modifiers)
				if (fa[s]) o += fa[s], ua[s] && a.push(s);
				else if ("exact" === s) {
				var c = e.modifiers;
				o += la(["ctrl", "shift", "alt", "meta"].filter(function (t) {
					return !c[t]
				}).map(function (t) {
					return "$event." + t + "Key"
				}).join("||"))
			} else a.push(s);
			a.length && (i += function (t) {
				return "if(!('button' in $event)&&" + t.map(mn).join("&&") + ")return null;"
			}(a)), o && (i += o);
			return "function($event){" + i + (n ? e.value + "($event)" : r ? "(" + e.value + ")($event)" : e.value) + "}"
		}
		return n || r ? e.value : "function($event){" + e.value + "}"
	}

	function mn(t) {
		var e = parseInt(t, 10);
		if (e) return "$event.keyCode!==" + e;
		var n = ua[t];
		return "_k($event.keyCode," + JSON.stringify(t) + "," + JSON.stringify(n) + ",$event.key)"
	}

	function yn(t, e) {
		var n = new da(e);
		return {
			render: "with(this){return " + (t ? gn(t, n) : '_c("div")') + "}",
			staticRenderFns: n.staticRenderFns
		}
	}

	function gn(t, e) {
		if (t.staticRoot && !t.staticProcessed) return _n(t, e);
		if (t.once && !t.onceProcessed) return bn(t, e);
		if (t.for && !t.forProcessed) return function (t, e, n, r) {
			var i = t.for,
				o = t.alias,
				a = t.iterator1 ? "," + t.iterator1 : "",
				s = t.iterator2 ? "," + t.iterator2 : "";
			return t.forProcessed = !0, (r || "_l") + "((" + i + "),function(" + o + a + s + "){return " + (n || gn)(t, e) + "})"
		}(t, e);
		if (t.if && !t.ifProcessed) return $n(t, e);
		if ("template" !== t.tag || t.slotTarget) {
			if ("slot" === t.tag) return function (t, e) {
				var n = t.slotName || '"default"',
					r = kn(t, e),
					i = "_t(" + n + (r ? "," + r : ""),
					o = t.attrs && "{" + t.attrs.map(function (t) {
						return Pn(t.name) + ":" + t.value
					}).join(",") + "}",
					a = t.attrsMap["v-bind"];
				!o && !a || r || (i += ",null");
				o && (i += "," + o);
				a && (i += (o ? "" : ",null") + "," + a);
				return i + ")"
			}(t, e);
			var n;
			if (t.component) n = function (t, e, n) {
				var r = e.inlineTemplate ? null : kn(e, n, !0);
				return "_c(" + t + "," + wn(e, n) + (r ? "," + r : "") + ")"
			}(t.component, t, e);
			else {
				var r = t.plain ? void 0 : wn(t, e),
					i = t.inlineTemplate ? null : kn(t, e, !0);
				n = "_c('" + t.tag + "'" + (r ? "," + r : "") + (i ? "," + i : "") + ")"
			}
			for (var o = 0; o < e.transforms.length; o++) n = e.transforms[o](t, n);
			return n
		}
		return kn(t, e) || "void 0"
	}

	function _n(t, e) {
		return t.staticProcessed = !0, e.staticRenderFns.push("with(this){return " + gn(t, e) + "}"), "_m(" + (e.staticRenderFns.length - 1) + (t.staticInFor ? ",true" : "") + ")"
	}

	function bn(t, e) {
		if (t.onceProcessed = !0, t.if && !t.ifProcessed) return $n(t, e);
		if (t.staticInFor) {
			for (var n = "", r = t.parent; r;) {
				if (r.for) {
					n = r.key;
					break
				}
				r = r.parent
			}
			return n ? "_o(" + gn(t, e) + "," + e.onceId++ + "," + n + ")" : gn(t, e)
		}
		return _n(t, e)
	}

	function $n(t, e, n, r) {
		return t.ifProcessed = !0, Cn(t.ifConditions.slice(), e, n, r)
	}

	function Cn(t, e, n, r) {
		function i(t) {
			return n ? n(t, e) : t.once ? bn(t, e) : gn(t, e)
		}
		if (!t.length) return r || "_e()";
		var o = t.shift();
		return o.exp ? "(" + o.exp + ")?" + i(o.block) + ":" + Cn(t, e, n, r) : "" + i(o.block)
	}

	function wn(t, e) {
		var n = "{",
			r = function (t, e) {
				var n = t.directives;
				if (!n) return;
				var r, i, o, a, s = "directives:[",
					c = !1;
				for (r = 0, i = n.length; r < i; r++) {
					o = n[r], a = !0;
					var u = e.directives[o.name];
					u && (a = !!u(t, o, e.warn)), a && (c = !0, s += '{name:"' + o.name + '",rawName:"' + o.rawName + '"' + (o.value ? ",value:(" + o.value + "),expression:" + JSON.stringify(o.value) : "") + (o.arg ? ',arg:"' + o.arg + '"' : "") + (o.modifiers ? ",modifiers:" + JSON.stringify(o.modifiers) : "") + "},")
				}
				if (c) return s.slice(0, -1) + "]"
			}(t, e);
		r && (n += r + ","), t.key && (n += "key:" + t.key + ","), t.ref && (n += "ref:" + t.ref + ","), t.refInFor && (n += "refInFor:true,"), t.pre && (n += "pre:true,"), t.component && (n += 'tag:"' + t.tag + '",');
		for (var i = 0; i < e.dataGenFns.length; i++) n += e.dataGenFns[i](t);
		if (t.attrs && (n += "attrs:{" + On(t.attrs) + "},"), t.props && (n += "domProps:{" + On(t.props) + "},"), t.events && (n += vn(t.events, !1, e.warn) + ","), t.nativeEvents && (n += vn(t.nativeEvents, !0, e.warn) + ","), t.slotTarget && !t.slotScope && (n += "slot:" + t.slotTarget + ","), t.scopedSlots && (n += function (t, e) {
				return "scopedSlots:_u([" + Object.keys(t).map(function (n) {
					return xn(n, t[n], e)
				}).join(",") + "])"
			}(t.scopedSlots, e) + ","), t.model && (n += "model:{value:" + t.model.value + ",callback:" + t.model.callback + ",expression:" + t.model.expression + "},"), t.inlineTemplate) {
			var o = function (t, e) {
				var n = t.children[0];
				if (1 === n.type) {
					var r = yn(n, e.options);
					return "inlineTemplate:{render:function(){" + r.render + "},staticRenderFns:[" + r.staticRenderFns.map(function (t) {
						return "function(){" + t + "}"
					}).join(",") + "]}"
				}
			}(t, e);
			o && (n += o + ",")
		}
		return n = n.replace(/,$/, "") + "}", t.wrapData && (n = t.wrapData(n)), t.wrapListeners && (n = t.wrapListeners(n)), n
	}

	function xn(t, e, n) {
		if (e.for && !e.forProcessed) return function (t, e, n) {
			var r = e.for,
				i = e.alias,
				o = e.iterator1 ? "," + e.iterator1 : "",
				a = e.iterator2 ? "," + e.iterator2 : "";
			return e.forProcessed = !0, "_l((" + r + "),function(" + i + o + a + "){return " + xn(t, e, n) + "})"
		}(t, e, n);
		return "{key:" + t + ",fn:" + ("function(" + String(e.slotScope) + "){return " + ("template" === e.tag ? e.if ? e.if+"?" + (kn(e, n) || "undefined") + ":undefined" : kn(e, n) || "undefined" : gn(e, n)) + "}") + "}"
	}

	function kn(t, e, n, r, i) {
		var o = t.children;
		if (o.length) {
			var a = o[0];
			if (1 === o.length && a.for && "template" !== a.tag && "slot" !== a.tag) return (r || gn)(a, e);
			var s = n ? function (t, e) {
					for (var n = 0, r = 0; r < t.length; r++) {
						var i = t[r];
						if (1 === i.type) {
							if (An(i) || i.ifConditions && i.ifConditions.some(function (t) {
									return An(t.block)
								})) {
								n = 2;
								break
							}(e(i) || i.ifConditions && i.ifConditions.some(function (t) {
								return e(t.block)
							})) && (n = 1)
						}
					}
					return n
				}(o, e.maybeComponent) : 0,
				c = i || function (t, e) {
					if (1 === t.type) return gn(t, e);
					return 3 === t.type && t.isComment ? function (t) {
						return "_e(" + JSON.stringify(t.text) + ")"
					}(t) : function (t) {
						return "_v(" + (2 === t.type ? t.expression : Sn(JSON.stringify(t.text))) + ")"
					}(t)
				};
			return "[" + o.map(function (t) {
				return c(t, e)
			}).join(",") + "]" + (s ? "," + s : "")
		}
	}

	function An(t) {
		return void 0 !== t.for || "template" === t.tag || "slot" === t.tag
	}

	function On(t) {
		for (var e = "", n = 0; n < t.length; n++) {
			var r = t[n];
			e += '"' + r.name + '":' + Sn(r.value) + ","
		}
		return e.slice(0, -1)
	}

	function Sn(t) {
		return t.replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
	}

	function Tn(t, e) {
		try {
			return new Function(t)
		} catch (n) {
			return e.push({
				err: n,
				code: t
			}), y
		}
	}

	function En(t) {
		return Ro = Ro || document.createElement("div"), Ro.innerHTML = t ? '<a href="\n"/>' : '<div a="\n"/>', Ro.innerHTML.indexOf("&#10;") > 0
	}
	var jn = Object.freeze({}),
		Nn = Object.prototype.toString,
		In = u("slot,component", !0),
		Ln = u("key,ref,slot,slot-scope,is"),
		Mn = Object.prototype.hasOwnProperty,
		Dn = /-(\w)/g,
		Pn = p(function (t) {
			return t.replace(Dn, function (t, e) {
				return e ? e.toUpperCase() : ""
			})
		}),
		Fn = p(function (t) {
			return t.charAt(0).toUpperCase() + t.slice(1)
		}),
		Rn = /\B([A-Z])/g,
		Hn = p(function (t) {
			return t.replace(Rn, "-$1").toLowerCase()
		}),
		Bn = function (t, e, n) {
			return !1
		},
		Un = function (t) {
			return t
		},
		Vn = "data-server-rendered",
		zn = ["component", "directive", "filter"],
		Kn = ["beforeCreate", "created", "beforeMount", "mounted", "beforeUpdate", "updated", "beforeDestroy", "destroyed", "activated", "deactivated", "errorCaptured"],
		Jn = {
			optionMergeStrategies: Object.create(null),
			silent: !1,
			productionTip: !1,
			devtools: !1,
			performance: !1,
			errorHandler: null,
			warnHandler: null,
			ignoredElements: [],
			keyCodes: Object.create(null),
			isReservedTag: Bn,
			isReservedAttr: Bn,
			isUnknownElement: Bn,
			getTagNamespace: y,
			parsePlatformTagName: Un,
			mustUseProp: Bn,
			_lifecycleHooks: Kn
		},
		qn = /[^\w.$]/,
		Wn = "__proto__" in {},
		Gn = "undefined" != typeof window,
		Zn = "undefined" != typeof WXEnvironment && !!WXEnvironment.platform,
		Xn = Zn && WXEnvironment.platform.toLowerCase(),
		Yn = Gn && window.navigator.userAgent.toLowerCase(),
		Qn = Yn && /msie|trident/.test(Yn),
		tr = Yn && Yn.indexOf("msie 9.0") > 0,
		er = Yn && Yn.indexOf("edge/") > 0,
		nr = Yn && Yn.indexOf("android") > 0 || "android" === Xn,
		rr = Yn && /iphone|ipad|ipod|ios/.test(Yn) || "ios" === Xn,
		ir = (Yn && /chrome\/\d+/.test(Yn), {}.watch),
		or = !1;
	if (Gn) try {
		var ar = {};
		Object.defineProperty(ar, "passive", {
			get: function () {
				or = !0
			}
		}), window.addEventListener("test-passive", null, ar)
	} catch (t) {}
	var sr, cr, ur = function () {
			return void 0 === sr && (sr = !Gn && "undefined" != typeof global && "server" === global.process.env.VUE_ENV), sr
		},
		lr = Gn && window.__VUE_DEVTOOLS_GLOBAL_HOOK__,
		fr = "undefined" != typeof Symbol && w(Symbol) && "undefined" != typeof Reflect && w(Reflect.ownKeys);
	cr = "undefined" != typeof Set && w(Set) ? Set : function () {
		function t() {
			this.set = Object.create(null)
		}
		return t.prototype.has = function (t) {
			return !0 === this.set[t]
		}, t.prototype.add = function (t) {
			this.set[t] = !0
		}, t.prototype.clear = function () {
			this.set = Object.create(null)
		}, t
	}();
	var pr = y,
		dr = 0,
		vr = function () {
			this.id = dr++, this.subs = []
		};
	vr.prototype.addSub = function (t) {
		this.subs.push(t)
	}, vr.prototype.removeSub = function (t) {
		l(this.subs, t)
	}, vr.prototype.depend = function () {
		vr.target && vr.target.addDep(this)
	}, vr.prototype.notify = function () {
		for (var t = this.subs.slice(), e = 0, n = t.length; e < n; e++) t[e].update()
	}, vr.target = null;
	var hr = [],
		mr = function (t, e, n, r, i, o, a, s) {
			this.tag = t, this.data = e, this.children = n, this.text = r, this.elm = i, this.ns = void 0, this.context = o, this.fnContext = void 0, this.fnOptions = void 0, this.fnScopeId = void 0, this.key = e && e.key, this.componentOptions = a, this.componentInstance = void 0, this.parent = void 0, this.raw = !1, this.isStatic = !1, this.isRootInsert = !0, this.isComment = !1, this.isCloned = !1, this.isOnce = !1, this.asyncFactory = s, this.asyncMeta = void 0, this.isAsyncPlaceholder = !1
		},
		yr = {
			child: {
				configurable: !0
			}
		};
	yr.child.get = function () {
		return this.componentInstance
	}, Object.defineProperties(mr.prototype, yr);
	var gr = function (t) {
			void 0 === t && (t = "");
			var e = new mr;
			return e.text = t, e.isComment = !0, e
		},
		_r = Array.prototype,
		br = Object.create(_r);
	["push", "pop", "shift", "unshift", "splice", "sort", "reverse"].forEach(function (t) {
		var e = _r[t];
		C(br, t, function () {
			for (var n = [], r = arguments.length; r--;) n[r] = arguments[r];
			var i, o = e.apply(this, n),
				a = this.__ob__;
			switch (t) {
				case "push":
				case "unshift":
					i = n;
					break;
				case "splice":
					i = n.slice(2)
			}
			return i && a.observeArray(i), a.dep.notify(), o
		})
	});
	var $r = Object.getOwnPropertyNames(br),
		Cr = {
			shouldConvert: !0
		},
		wr = function (t) {
			if (this.value = t, this.dep = new vr, this.vmCount = 0, C(t, "__ob__", this), Array.isArray(t)) {
				(Wn ? O : S)(t, br, $r), this.observeArray(t)
			} else this.walk(t)
		};
	wr.prototype.walk = function (t) {
		for (var e = Object.keys(t), n = 0; n < e.length; n++) E(t, e[n], t[e[n]])
	}, wr.prototype.observeArray = function (t) {
		for (var e = 0, n = t.length; e < n; e++) T(t[e])
	};
	var xr = Jn.optionMergeStrategies;
	xr.data = function (t, e, n) {
		return n ? M(t, e, n) : e && "function" != typeof e ? t : M(t, e)
	}, Kn.forEach(function (t) {
		xr[t] = D
	}), zn.forEach(function (t) {
		xr[t + "s"] = P
	}), xr.watch = function (t, e, n, r) {
		if (t === ir && (t = void 0), e === ir && (e = void 0), !e) return Object.create(t || null);
		if (!t) return e;
		var i = {};
		h(i, t);
		for (var o in e) {
			var a = i[o],
				s = e[o];
			a && !Array.isArray(a) && (a = [a]), i[o] = a ? a.concat(s) : Array.isArray(s) ? s : [s]
		}
		return i
	}, xr.props = xr.methods = xr.inject = xr.computed = function (t, e, n, r) {
		if (!t) return e;
		var i = Object.create(null);
		return h(i, t), e && h(i, e), i
	}, xr.provide = M;
	var kr, Ar, Or = function (t, e) {
			return void 0 === e ? t : e
		},
		Sr = [],
		Tr = !1,
		Er = !1;
	if ("undefined" != typeof setImmediate && w(setImmediate)) Ar = function () {
		setImmediate(J)
	};
	else if ("undefined" == typeof MessageChannel || !w(MessageChannel) && "[object MessageChannelConstructor]" !== MessageChannel.toString()) Ar = function () {
		setTimeout(J, 0)
	};
	else {
		var jr = new MessageChannel,
			Nr = jr.port2;
		jr.port1.onmessage = J, Ar = function () {
			Nr.postMessage(1)
		}
	}
	if ("undefined" != typeof Promise && w(Promise)) {
		var Ir = Promise.resolve();
		kr = function () {
			Ir.then(J), rr && setTimeout(y)
		}
	} else kr = Ar;
	var Lr, Mr = new cr,
		Dr = p(function (t) {
			var e = "&" === t.charAt(0),
				n = "~" === (t = e ? t.slice(1) : t).charAt(0),
				r = "!" === (t = n ? t.slice(1) : t).charAt(0);
			return t = r ? t.slice(1) : t, {
				name: t,
				once: n,
				capture: r,
				passive: e
			}
		}),
		Pr = null,
		Fr = [],
		Rr = [],
		Hr = {},
		Br = !1,
		Ur = !1,
		Vr = 0,
		zr = 0,
		Kr = function (t, e, n, r, i) {
			this.vm = t, i && (t._watcher = this), t._watchers.push(this), r ? (this.deep = !!r.deep, this.user = !!r.user, this.lazy = !!r.lazy, this.sync = !!r.sync) : this.deep = this.user = this.lazy = this.sync = !1, this.cb = n, this.id = ++zr, this.active = !0, this.dirty = this.lazy, this.deps = [], this.newDeps = [], this.depIds = new cr, this.newDepIds = new cr, this.expression = "", "function" == typeof e ? this.getter = e : (this.getter = function (t) {
				if (!qn.test(t)) {
					var e = t.split(".");
					return function (t) {
						for (var n = 0; n < e.length; n++) {
							if (!t) return;
							t = t[e[n]]
						}
						return t
					}
				}
			}(e), this.getter || (this.getter = function () {})), this.value = this.lazy ? void 0 : this.get()
		};
	Kr.prototype.get = function () {
		! function (t) {
			vr.target && hr.push(vr.target), vr.target = t
		}(this);
		var t, e = this.vm;
		try {
			t = this.getter.call(e, e)
		} catch (t) {
			if (!this.user) throw t;
			V(t, e, 'getter for watcher "' + this.expression + '"')
		} finally {
			this.deep && W(t), vr.target = hr.pop(), this.cleanupDeps()
		}
		return t
	}, Kr.prototype.addDep = function (t) {
		var e = t.id;
		this.newDepIds.has(e) || (this.newDepIds.add(e), this.newDeps.push(t), this.depIds.has(e) || t.addSub(this))
	}, Kr.prototype.cleanupDeps = function () {
		for (var t = this.deps.length; t--;) {
			var e = this.deps[t];
			this.newDepIds.has(e.id) || e.removeSub(this)
		}
		var n = this.depIds;
		this.depIds = this.newDepIds, this.newDepIds = n, this.newDepIds.clear(), n = this.deps, this.deps = this.newDeps, this.newDeps = n, this.newDeps.length = 0
	}, Kr.prototype.update = function () {
		this.lazy ? this.dirty = !0 : this.sync ? this.run() : function (t) {
			var e = t.id;
			if (null == Hr[e]) {
				if (Hr[e] = !0, Ur) {
					for (var n = Fr.length - 1; n > Vr && Fr[n].id > t.id;) n--;
					Fr.splice(n + 1, 0, t)
				} else Fr.push(t);
				Br || (Br = !0, q(ht))
			}
		}(this)
	}, Kr.prototype.run = function () {
		if (this.active) {
			var t = this.get();
			if (t !== this.value || i(t) || this.deep) {
				var e = this.value;
				if (this.value = t, this.user) try {
					this.cb.call(this.vm, t, e)
				} catch (t) {
					V(t, this.vm, 'callback for watcher "' + this.expression + '"')
				} else this.cb.call(this.vm, t, e)
			}
		}
	}, Kr.prototype.evaluate = function () {
		this.value = this.get(), this.dirty = !1
	}, Kr.prototype.depend = function () {
		for (var t = this.deps.length; t--;) this.deps[t].depend()
	}, Kr.prototype.teardown = function () {
		if (this.active) {
			this.vm._isBeingDestroyed || l(this.vm._watchers, this);
			for (var t = this.deps.length; t--;) this.deps[t].removeSub(this);
			this.active = !1
		}
	};
	var Jr = {
			enumerable: !0,
			configurable: !0,
			get: y,
			set: y
		},
		qr = {
			lazy: !0
		};
	Nt(It.prototype);
	var Wr = {
			init: function (t, n, r, i) {
				if (!t.componentInstance || t.componentInstance._isDestroyed) {
					(t.componentInstance = function (t, n, r, i) {
						var o = {
								_isComponent: !0,
								parent: n,
								_parentVnode: t,
								_parentElm: r || null,
								_refElm: i || null
							},
							a = t.data.inlineTemplate;
						return e(a) && (o.render = a.render, o.staticRenderFns = a.staticRenderFns), new t.componentOptions.Ctor(o)
					}(t, Pr, r, i)).$mount(n ? t.elm : void 0, n)
				} else if (t.data.keepAlive) {
					var o = t;
					Wr.prepatch(o, o)
				}
			},
			prepatch: function (t, e) {
				var n = e.componentOptions;
				! function (t, e, n, r, i) {
					var o = !!(i || t.$options._renderChildren || r.data.scopedSlots || t.$scopedSlots !== jn);
					if (t.$options._parentVnode = r, t.$vnode = r, t._vnode && (t._vnode.parent = r), t.$options._renderChildren = i, t.$attrs = r.data && r.data.attrs || jn, t.$listeners = n || jn, e && t.$options.props) {
						Cr.shouldConvert = !1;
						for (var a = t._props, s = t.$options._propKeys || [], c = 0; c < s.length; c++) {
							var u = s[c];
							a[u] = H(u, t.$options.props, e, t)
						}
						Cr.shouldConvert = !0, t.$options.propsData = e
					}
					if (n) {
						var l = t.$options._parentListeners;
						t.$options._parentListeners = n, st(t, n, l)
					}
					o && (t.$slots = ct(i, r.context), t.$forceUpdate())
				}(e.componentInstance = t.componentInstance, n.propsData, n.listeners, e, n.children)
			},
			insert: function (t) {
				var e = t.context,
					n = t.componentInstance;
				n._isMounted || (n._isMounted = !0, vt(n, "mounted")), t.data.keepAlive && (e._isMounted ? function (t) {
					t._inactive = !1, Rr.push(t)
				}(n) : pt(n, !0))
			},
			destroy: function (t) {
				var e = t.componentInstance;
				e._isDestroyed || (t.data.keepAlive ? dt(e, !0) : e.$destroy())
			}
		},
		Gr = Object.keys(Wr),
		Zr = 1,
		Xr = 2,
		Yr = 0;
	! function (t) {
		t.prototype._init = function (t) {
			this._uid = Yr++, this._isVue = !0, t && t._isComponent ? function (t, e) {
					var n = t.$options = Object.create(t.constructor.options),
						r = e._parentVnode;
					n.parent = e.parent, n._parentVnode = r, n._parentElm = e._parentElm, n._refElm = e._refElm;
					var i = r.componentOptions;
					n.propsData = i.propsData, n._parentListeners = i.listeners, n._renderChildren = i.children, n._componentTag = i.tag, e.render && (n.render = e.render, n.staticRenderFns = e.staticRenderFns)
				}(this, t) : this.$options = F(Ft(this.constructor), t || {}, this), this._renderProxy = this, this._self = this,
				function (t) {
					var e = t.$options,
						n = e.parent;
					if (n && !e.abstract) {
						for (; n.$options.abstract && n.$parent;) n = n.$parent;
						n.$children.push(t)
					}
					t.$parent = n, t.$root = n ? n.$root : t, t.$children = [], t.$refs = {}, t._watcher = null, t._inactive = null, t._directInactive = !1, t._isMounted = !1, t._isDestroyed = !1, t._isBeingDestroyed = !1
				}(this),
				function (t) {
					t._events = Object.create(null), t._hasHookEvent = !1;
					var e = t.$options._parentListeners;
					e && st(t, e)
				}(this),
				function (t) {
					t._vnode = null, t._staticTrees = null;
					var e = t.$options,
						n = t.$vnode = e._parentVnode,
						r = n && n.context;
					t.$slots = ct(e._renderChildren, r), t.$scopedSlots = jn, t._c = function (e, n, r, i) {
						return Dt(t, e, n, r, i, !1)
					}, t.$createElement = function (e, n, r, i) {
						return Dt(t, e, n, r, i, !0)
					};
					var i = n && n.data;
					E(t, "$attrs", i && i.attrs || jn, 0, !0), E(t, "$listeners", e._parentListeners || jn, 0, !0)
				}(this), vt(this, "beforeCreate"),
				function (t) {
					var e = $t(t.$options.inject, t);
					e && (Cr.shouldConvert = !1, Object.keys(e).forEach(function (n) {
						E(t, n, e[n])
					}), Cr.shouldConvert = !0)
				}(this), yt(this),
				function (t) {
					var e = t.$options.provide;
					e && (t._provided = "function" == typeof e ? e.call(t) : e)
				}(this), vt(this, "created"), this.$options.el && this.$mount(this.$options.el)
		}
	}(Rt),
	function (t) {
		var e = {};
		e.get = function () {
			return this._data
		};
		var n = {};
		n.get = function () {
			return this._props
		}, Object.defineProperty(t.prototype, "$data", e), Object.defineProperty(t.prototype, "$props", n), t.prototype.$set = j, t.prototype.$delete = N, t.prototype.$watch = function (t, e, n) {
			if (o(e)) return bt(this, t, e, n);
			(n = n || {}).user = !0;
			var r = new Kr(this, t, e, n);
			return n.immediate && e.call(this, r.value),
				function () {
					r.teardown()
				}
		}
	}(Rt),
	function (t) {
		var e = /^hook:/;
		t.prototype.$on = function (t, n) {
			if (Array.isArray(t))
				for (var r = 0, i = t.length; r < i; r++) this.$on(t[r], n);
			else(this._events[t] || (this._events[t] = [])).push(n), e.test(t) && (this._hasHookEvent = !0);
			return this
		}, t.prototype.$once = function (t, e) {
			function n() {
				r.$off(t, n), e.apply(r, arguments)
			}
			var r = this;
			return n.fn = e, r.$on(t, n), r
		}, t.prototype.$off = function (t, e) {
			if (!arguments.length) return this._events = Object.create(null), this;
			if (Array.isArray(t)) {
				for (var n = 0, r = t.length; n < r; n++) this.$off(t[n], e);
				return this
			}
			var i = this._events[t];
			if (!i) return this;
			if (!e) return this._events[t] = null, this;
			if (e)
				for (var o, a = i.length; a--;)
					if ((o = i[a]) === e || o.fn === e) {
						i.splice(a, 1);
						break
					}
			return this
		}, t.prototype.$emit = function (t) {
			var e = this,
				n = e._events[t];
			if (n) {
				n = n.length > 1 ? v(n) : n;
				for (var r = v(arguments, 1), i = 0, o = n.length; i < o; i++) try {
					n[i].apply(e, r)
				} catch (n) {
					V(n, e, 'event handler for "' + t + '"')
				}
			}
			return e
		}
	}(Rt),
	function (t) {
		t.prototype._update = function (t, e) {
			this._isMounted && vt(this, "beforeUpdate");
			var n = this.$el,
				r = this._vnode,
				i = Pr;
			Pr = this, this._vnode = t, r ? this.$el = this.__patch__(r, t) : (this.$el = this.__patch__(this.$el, t, e, !1, this.$options._parentElm, this.$options._refElm), this.$options._parentElm = this.$options._refElm = null), Pr = i, n && (n.__vue__ = null), this.$el && (this.$el.__vue__ = this), this.$vnode && this.$parent && this.$vnode === this.$parent._vnode && (this.$parent.$el = this.$el)
		}, t.prototype.$forceUpdate = function () {
			this._watcher && this._watcher.update()
		}, t.prototype.$destroy = function () {
			if (!this._isBeingDestroyed) {
				vt(this, "beforeDestroy"), this._isBeingDestroyed = !0;
				var t = this.$parent;
				!t || t._isBeingDestroyed || this.$options.abstract || l(t.$children, this), this._watcher && this._watcher.teardown();
				for (var e = this._watchers.length; e--;) this._watchers[e].teardown();
				this._data.__ob__ && this._data.__ob__.vmCount--, this._isDestroyed = !0, this.__patch__(this._vnode, null), vt(this, "destroyed"), this.$off(), this.$el && (this.$el.__vue__ = null), this.$vnode && (this.$vnode.parent = null)
			}
		}
	}(Rt),
	function (t) {
		Nt(t.prototype), t.prototype.$nextTick = function (t) {
			return q(t, this)
		}, t.prototype._render = function () {
			var t = this,
				e = t.$options,
				n = e.render,
				r = e._parentVnode;
			if (t._isMounted)
				for (var i in t.$slots) {
					var o = t.$slots[i];
					(o._rendered || o[0] && o[0].elm) && (t.$slots[i] = A(o, !0))
				}
			t.$scopedSlots = r && r.data.scopedSlots || jn, t.$vnode = r;
			var a;
			try {
				a = n.call(t._renderProxy, t.$createElement)
			} catch (e) {
				V(e, t, "render"), a = t._vnode
			}
			return a instanceof mr || (a = gr()), a.parent = r, a
		}
	}(Rt);
	var Qr = [String, RegExp, Array],
		ti = {
			KeepAlive: {
				name: "keep-alive",
				abstract: !0,
				props: {
					include: Qr,
					exclude: Qr,
					max: [String, Number]
				},
				created: function () {
					this.cache = Object.create(null), this.keys = []
				},
				destroyed: function () {
					for (var t in this.cache) zt(this.cache, t, this.keys)
				},
				watch: {
					include: function (t) {
						Vt(this, function (e) {
							return Ut(t, e)
						})
					},
					exclude: function (t) {
						Vt(this, function (e) {
							return !Ut(t, e)
						})
					}
				},
				render: function () {
					var t = this.$slots.default,
						e = it(t),
						n = e && e.componentOptions;
					if (n) {
						var r = Bt(n),
							i = this.include,
							o = this.exclude;
						if (i && (!r || !Ut(i, r)) || o && r && Ut(o, r)) return e;
						var a = this.cache,
							s = this.keys,
							c = null == e.key ? n.Ctor.cid + (n.tag ? "::" + n.tag : "") : e.key;
						a[c] ? (e.componentInstance = a[c].componentInstance, l(s, c), s.push(c)) : (a[c] = e, s.push(c), this.max && s.length > parseInt(this.max) && zt(a, s[0], s, this._vnode)), e.data.keepAlive = !0
					}
					return e || t && t[0]
				}
			}
		};
	! function (t) {
		var e = {};
		e.get = function () {
				return Jn
			}, Object.defineProperty(t, "config", e), t.util = {
				warn: pr,
				extend: h,
				mergeOptions: F,
				defineReactive: E
			}, t.set = j, t.delete = N, t.nextTick = q, t.options = Object.create(null), zn.forEach(function (e) {
				t.options[e + "s"] = Object.create(null)
			}), t.options._base = t, h(t.options.components, ti),
			function (t) {
				t.use = function (t) {
					var e = this._installedPlugins || (this._installedPlugins = []);
					if (e.indexOf(t) > -1) return this;
					var n = v(arguments, 1);
					return n.unshift(this), "function" == typeof t.install ? t.install.apply(t, n) : "function" == typeof t && t.apply(null, n), e.push(t), this
				}
			}(t),
			function (t) {
				t.mixin = function (t) {
					return this.options = F(this.options, t), this
				}
			}(t), Ht(t),
			function (t) {
				zn.forEach(function (e) {
					t[e] = function (t, n) {
						return n ? ("component" === e && o(n) && (n.name = n.name || t, n = this.options._base.extend(n)), "directive" === e && "function" == typeof n && (n = {
							bind: n,
							update: n
						}), this.options[e + "s"][t] = n, n) : this.options[e + "s"][t]
					}
				})
			}(t)
	}(Rt), Object.defineProperty(Rt.prototype, "$isServer", {
		get: ur
	}), Object.defineProperty(Rt.prototype, "$ssrContext", {
		get: function () {
			return this.$vnode && this.$vnode.ssrContext
		}
	}), Rt.version = "2.5.13";
	var ei, ni, ri, ii, oi, ai, si, ci, ui = u("style,class"),
		li = u("input,textarea,option,select,progress"),
		fi = function (t, e, n) {
			return "value" === n && li(t) && "button" !== e || "selected" === n && "option" === t || "checked" === n && "input" === t || "muted" === n && "video" === t
		},
		pi = u("contenteditable,draggable,spellcheck"),
		di = u("allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,default,defaultchecked,defaultmuted,defaultselected,defer,disabled,enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple,muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly,required,reversed,scoped,seamless,selected,sortable,translate,truespeed,typemustmatch,visible"),
		vi = "http://www.w3.org/1999/xlink",
		hi = function (t) {
			return ":" === t.charAt(5) && "xlink" === t.slice(0, 5)
		},
		mi = function (t) {
			return hi(t) ? t.slice(6, t.length) : ""
		},
		yi = function (t) {
			return null == t || !1 === t
		},
		gi = {
			svg: "http://www.w3.org/2000/svg",
			math: "http://www.w3.org/1998/Math/MathML"
		},
		_i = u("html,body,base,head,link,meta,style,title,address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,menuitem,summary,content,element,shadow,template,blockquote,iframe,tfoot"),
		bi = u("svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view", !0),
		$i = function (t) {
			return _i(t) || bi(t)
		},
		Ci = Object.create(null),
		wi = u("text,number,password,search,email,tel,url"),
		xi = Object.freeze({
			createElement: function (t, e) {
				var n = document.createElement(t);
				return "select" !== t ? n : (e.data && e.data.attrs && void 0 !== e.data.attrs.multiple && n.setAttribute("multiple", "multiple"), n)
			},
			createElementNS: function (t, e) {
				return document.createElementNS(gi[t], e)
			},
			createTextNode: function (t) {
				return document.createTextNode(t)
			},
			createComment: function (t) {
				return document.createComment(t)
			},
			insertBefore: function (t, e, n) {
				t.insertBefore(e, n)
			},
			removeChild: function (t, e) {
				t.removeChild(e)
			},
			appendChild: function (t, e) {
				t.appendChild(e)
			},
			parentNode: function (t) {
				return t.parentNode
			},
			nextSibling: function (t) {
				return t.nextSibling
			},
			tagName: function (t) {
				return t.tagName
			},
			setTextContent: function (t, e) {
				t.textContent = e
			},
			setAttribute: function (t, e, n) {
				t.setAttribute(e, n)
			}
		}),
		ki = {
			create: function (t, e) {
				Xt(e)
			},
			update: function (t, e) {
				t.data.ref !== e.data.ref && (Xt(t, !0), Xt(e))
			},
			destroy: function (t) {
				Xt(t, !0)
			}
		},
		Ai = new mr("", {}, []),
		Oi = ["create", "activate", "update", "remove", "destroy"],
		Si = {
			create: te,
			update: te,
			destroy: function (t) {
				te(t, Ai)
			}
		},
		Ti = Object.create(null),
		Ei = [ki, Si],
		ji = {
			create: re,
			update: re
		},
		Ni = {
			create: oe,
			update: oe
		},
		Ii = /[\w).+\-_$\]]/,
		Li = "__r",
		Mi = "__c",
		Di = {
			create: xe,
			update: xe
		},
		Pi = {
			create: ke,
			update: ke
		},
		Fi = p(function (t) {
			var e = {},
				n = /:(.+)/;
			return t.split(/;(?![^(]*\))/g).forEach(function (t) {
				if (t) {
					var r = t.split(n);
					r.length > 1 && (e[r[0].trim()] = r[1].trim())
				}
			}), e
		}),
		Ri = /^--/,
		Hi = /\s*!important$/,
		Bi = function (t, e, n) {
			if (Ri.test(e)) t.style.setProperty(e, n);
			else if (Hi.test(n)) t.style.setProperty(e, n.replace(Hi, ""), "important");
			else {
				var r = Vi(e);
				if (Array.isArray(n))
					for (var i = 0, o = n.length; i < o; i++) t.style[r] = n[i];
				else t.style[r] = n
			}
		},
		Ui = ["Webkit", "Moz", "ms"],
		Vi = p(function (t) {
			if (ci = ci || document.createElement("div").style, "filter" !== (t = Pn(t)) && t in ci) return t;
			for (var e = t.charAt(0).toUpperCase() + t.slice(1), n = 0; n < Ui.length; n++) {
				var r = Ui[n] + e;
				if (r in ci) return r
			}
		}),
		zi = {
			create: Se,
			update: Se
		},
		Ki = p(function (t) {
			return {
				enterClass: t + "-enter",
				enterToClass: t + "-enter-to",
				enterActiveClass: t + "-enter-active",
				leaveClass: t + "-leave",
				leaveToClass: t + "-leave-to",
				leaveActiveClass: t + "-leave-active"
			}
		}),
		Ji = Gn && !tr,
		qi = "transition",
		Wi = "animation",
		Gi = "transition",
		Zi = "transitionend",
		Xi = "animation",
		Yi = "animationend";
	Ji && (void 0 === window.ontransitionend && void 0 !== window.onwebkittransitionend && (Gi = "WebkitTransition", Zi = "webkitTransitionEnd"), void 0 === window.onanimationend && void 0 !== window.onwebkitanimationend && (Xi = "WebkitAnimation", Yi = "webkitAnimationEnd"));
	var Qi = Gn ? window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : setTimeout : function (t) {
			return t()
		},
		to = /\b(transform|all)(,|$)/,
		eo = function (i) {
			function o(t) {
				var n = A.parentNode(t);
				e(n) && A.removeChild(n, t)
			}

			function a(t, r, i, o, a) {
				if (t.isRootInsert = !a, ! function (t, r, i, o) {
						var a = t.data;
						if (e(a)) {
							var u = e(t.componentInstance) && a.keepAlive;
							if (e(a = a.hook) && e(a = a.init) && a(t, !1, i, o), e(t.componentInstance)) return s(t, r), n(u) && function (t, n, r, i) {
								for (var o, a = t; a.componentInstance;)
									if (a = a.componentInstance._vnode, e(o = a.data) && e(o = o.transition)) {
										for (o = 0; o < x.activate.length; ++o) x.activate[o](Ai, a);
										n.push(a);
										break
									}
								c(r, t.elm, i)
							}(t, r, i, o), !0
						}
					}(t, r, i, o)) {
					var u = t.data,
						f = t.children,
						v = t.tag;
					e(v) ? (t.elm = t.ns ? A.createElementNS(t.ns, v) : A.createElement(v, t), d(t), l(t, f, r), e(u) && p(t, r), c(i, t.elm, o)) : n(t.isComment) ? (t.elm = A.createComment(t.text), c(i, t.elm, o)) : (t.elm = A.createTextNode(t.text), c(i, t.elm, o))
				}
			}

			function s(t, n) {
				e(t.data.pendingInsert) && (n.push.apply(n, t.data.pendingInsert), t.data.pendingInsert = null), t.elm = t.componentInstance.$el, f(t) ? (p(t, n), d(t)) : (Xt(t), n.push(t))
			}

			function c(t, n, r) {
				e(t) && (e(r) ? r.parentNode === t && A.insertBefore(t, n, r) : A.appendChild(t, n))
			}

			function l(t, e, n) {
				if (Array.isArray(e))
					for (var i = 0; i < e.length; ++i) a(e[i], n, t.elm, null, !0);
				else r(t.text) && A.appendChild(t.elm, A.createTextNode(String(t.text)))
			}

			function f(t) {
				for (; t.componentInstance;) t = t.componentInstance._vnode;
				return e(t.tag)
			}

			function p(t, n) {
				for (var r = 0; r < x.create.length; ++r) x.create[r](Ai, t);
				e(C = t.data.hook) && (e(C.create) && C.create(Ai, t), e(C.insert) && n.push(t))
			}

			function d(t) {
				var n;
				if (e(n = t.fnScopeId)) A.setAttribute(t.elm, n, "");
				else
					for (var r = t; r;) e(n = r.context) && e(n = n.$options._scopeId) && A.setAttribute(t.elm, n, ""), r = r.parent;
				e(n = Pr) && n !== t.context && n !== t.fnContext && e(n = n.$options._scopeId) && A.setAttribute(t.elm, n, "")
			}

			function v(t, e, n, r, i, o) {
				for (; r <= i; ++r) a(n[r], o, t, e)
			}

			function h(t) {
				var n, r, i = t.data;
				if (e(i))
					for (e(n = i.hook) && e(n = n.destroy) && n(t), n = 0; n < x.destroy.length; ++n) x.destroy[n](t);
				if (e(n = t.children))
					for (r = 0; r < t.children.length; ++r) h(t.children[r])
			}

			function m(t, n, r, i) {
				for (; r <= i; ++r) {
					var a = n[r];
					e(a) && (e(a.tag) ? (y(a), h(a)) : o(a.elm))
				}
			}

			function y(t, n) {
				if (e(n) || e(t.data)) {
					var r, i = x.remove.length + 1;
					for (e(n) ? n.listeners += i : n = function (t, e) {
							function n() {
								0 == --n.listeners && o(t)
							}
							return n.listeners = e, n
						}(t.elm, i), e(r = t.componentInstance) && e(r = r._vnode) && e(r.data) && y(r, n), r = 0; r < x.remove.length; ++r) x.remove[r](t, n);
					e(r = t.data.hook) && e(r = r.remove) ? r(t, n) : n()
				} else o(t.elm)
			}

			function g(n, r, i, o, s) {
				for (var c, u, l, f = 0, p = 0, d = r.length - 1, h = r[0], y = r[d], g = i.length - 1, b = i[0], $ = i[g], C = !s; f <= d && p <= g;) t(h) ? h = r[++f] : t(y) ? y = r[--d] : Yt(h, b) ? (_(h, b, o), h = r[++f], b = i[++p]) : Yt(y, $) ? (_(y, $, o), y = r[--d], $ = i[--g]) : Yt(h, $) ? (_(h, $, o), C && A.insertBefore(n, h.elm, A.nextSibling(y.elm)), h = r[++f], $ = i[--g]) : Yt(y, b) ? (_(y, b, o), C && A.insertBefore(n, y.elm, h.elm), y = r[--d], b = i[++p]) : (t(c) && (c = Qt(r, f, d)), t(u = e(b.key) ? c[b.key] : function (t, n, r, i) {
					for (var o = r; o < i; o++) {
						var a = n[o];
						if (e(a) && Yt(t, a)) return o
					}
				}(b, r, f, d)) ? a(b, o, n, h.elm) : Yt(l = r[u], b) ? (_(l, b, o), r[u] = void 0, C && A.insertBefore(n, l.elm, h.elm)) : a(b, o, n, h.elm), b = i[++p]);
				f > d ? v(n, t(i[g + 1]) ? null : i[g + 1].elm, i, p, g, o) : p > g && m(0, r, f, d)
			}

			function _(r, i, o, a) {
				if (r !== i) {
					var s = i.elm = r.elm;
					if (n(r.isAsyncPlaceholder)) e(i.asyncFactory.resolved) ? $(r.elm, i, o) : i.isAsyncPlaceholder = !0;
					else if (n(i.isStatic) && n(r.isStatic) && i.key === r.key && (n(i.isCloned) || n(i.isOnce))) i.componentInstance = r.componentInstance;
					else {
						var c, u = i.data;
						e(u) && e(c = u.hook) && e(c = c.prepatch) && c(r, i);
						var l = r.children,
							p = i.children;
						if (e(u) && f(i)) {
							for (c = 0; c < x.update.length; ++c) x.update[c](r, i);
							e(c = u.hook) && e(c = c.update) && c(r, i)
						}
						t(i.text) ? e(l) && e(p) ? l !== p && g(s, l, p, o, a) : e(p) ? (e(r.text) && A.setTextContent(s, ""), v(s, null, p, 0, p.length - 1, o)) : e(l) ? m(0, l, 0, l.length - 1) : e(r.text) && A.setTextContent(s, "") : r.text !== i.text && A.setTextContent(s, i.text), e(u) && e(c = u.hook) && e(c = c.postpatch) && c(r, i)
					}
				}
			}

			function b(t, r, i) {
				if (n(i) && e(t.parent)) t.parent.data.pendingInsert = r;
				else
					for (var o = 0; o < r.length; ++o) r[o].data.hook.insert(r[o])
			}

			function $(t, r, i, o) {
				var a, c = r.tag,
					u = r.data,
					f = r.children;
				if (o = o || u && u.pre, r.elm = t, n(r.isComment) && e(r.asyncFactory)) return r.isAsyncPlaceholder = !0, !0;
				if (e(u) && (e(a = u.hook) && e(a = a.init) && a(r, !0), e(a = r.componentInstance))) return s(r, i), !0;
				if (e(c)) {
					if (e(f))
						if (t.hasChildNodes())
							if (e(a = u) && e(a = a.domProps) && e(a = a.innerHTML)) {
								if (a !== t.innerHTML) return !1
							} else {
								for (var d = !0, v = t.firstChild, h = 0; h < f.length; h++) {
									if (!v || !$(v, f[h], i, o)) {
										d = !1;
										break
									}
									v = v.nextSibling
								}
								if (!d || v) return !1
							}
					else l(r, f, i);
					if (e(u)) {
						var m = !1;
						for (var y in u)
							if (!O(y)) {
								m = !0, p(r, i);
								break
							}! m && u.class && W(u.class)
					}
				} else t.data !== r.text && (t.data = r.text);
				return !0
			}
			var C, w, x = {},
				k = i.modules,
				A = i.nodeOps;
			for (C = 0; C < Oi.length; ++C)
				for (x[Oi[C]] = [], w = 0; w < k.length; ++w) e(k[w][Oi[C]]) && x[Oi[C]].push(k[w][Oi[C]]);
			var O = u("attrs,class,staticClass,staticStyle,key");
			return function (r, i, o, s, c, u) {
				if (!t(i)) {
					var l = !1,
						p = [];
					if (t(r)) l = !0, a(i, p, c, u);
					else {
						var d = e(r.nodeType);
						if (!d && Yt(r, i)) _(r, i, p, s);
						else {
							if (d) {
								if (1 === r.nodeType && r.hasAttribute(Vn) && (r.removeAttribute(Vn), o = !0), n(o) && $(r, i, p)) return b(i, p, !0), r;
								r = function (t) {
									return new mr(A.tagName(t).toLowerCase(), {}, [], void 0, t)
								}(r)
							}
							var v = r.elm,
								y = A.parentNode(v);
							if (a(i, p, v._leaveCb ? null : y, A.nextSibling(v)), e(i.parent))
								for (var g = i.parent, C = f(i); g;) {
									for (var w = 0; w < x.destroy.length; ++w) x.destroy[w](g);
									if (g.elm = i.elm, C) {
										for (var k = 0; k < x.create.length; ++k) x.create[k](Ai, g);
										var O = g.data.hook.insert;
										if (O.merged)
											for (var S = 1; S < O.fns.length; S++) O.fns[S]()
									} else Xt(g);
									g = g.parent
								}
							e(y) ? m(0, [r], 0, 0) : e(r.tag) && h(r)
						}
					}
					return b(i, p, l), i.elm
				}
				e(r) && h(r)
			}
		}({
			nodeOps: xi,
			modules: [ji, Ni, Di, Pi, zi, Gn ? {
				create: Ve,
				activate: Ve,
				remove: function (t, e) {
					!0 !== t.data.show ? He(t, e) : e()
				}
			} : {}].concat(Ei)
		});
	tr && document.addEventListener("selectionchange", function () {
		var t = document.activeElement;
		t && t.vmodel && Ze(t, "input")
	});
	var no = {
			inserted: function (t, e, n, r) {
				"select" === n.tag ? (r.elm && !r.elm._vOptions ? Y(n, "postpatch", function () {
					no.componentUpdated(t, e, n)
				}) : ze(t, e, n.context), t._vOptions = [].map.call(t.options, qe)) : ("textarea" === n.tag || wi(t.type)) && (t._vModifiers = e.modifiers, e.modifiers.lazy || (t.addEventListener("change", Ge), nr || (t.addEventListener("compositionstart", We), t.addEventListener("compositionend", Ge)), tr && (t.vmodel = !0)))
			},
			componentUpdated: function (t, e, n) {
				if ("select" === n.tag) {
					ze(t, e, n.context);
					var r = t._vOptions,
						i = t._vOptions = [].map.call(t.options, qe);
					if (i.some(function (t, e) {
							return !g(t, r[e])
						})) {
						(t.multiple ? e.value.some(function (t) {
							return Je(t, i)
						}) : e.value !== e.oldValue && Je(e.value, i)) && Ze(t, "change")
					}
				}
			}
		},
		ro = {
			model: no,
			show: {
				bind: function (t, e, n) {
					var r = e.value,
						i = (n = Xe(n)).data && n.data.transition,
						o = t.__vOriginalDisplay = "none" === t.style.display ? "" : t.style.display;
					r && i ? (n.data.show = !0, Re(n, function () {
						t.style.display = o
					})) : t.style.display = r ? o : "none"
				},
				update: function (t, e, n) {
					var r = e.value;
					if (r !== e.oldValue) {
						(n = Xe(n)).data && n.data.transition ? (n.data.show = !0, r ? Re(n, function () {
							t.style.display = t.__vOriginalDisplay
						}) : He(n, function () {
							t.style.display = "none"
						})) : t.style.display = r ? t.__vOriginalDisplay : "none"
					}
				},
				unbind: function (t, e, n, r, i) {
					i || (t.style.display = t.__vOriginalDisplay)
				}
			}
		},
		io = {
			name: String,
			appear: Boolean,
			css: Boolean,
			mode: String,
			type: String,
			enterClass: String,
			leaveClass: String,
			enterToClass: String,
			leaveToClass: String,
			enterActiveClass: String,
			leaveActiveClass: String,
			appearClass: String,
			appearActiveClass: String,
			appearToClass: String,
			duration: [Number, String, Object]
		},
		oo = {
			name: "transition",
			props: io,
			abstract: !0,
			render: function (t) {
				var e = this,
					n = this.$slots.default;
				if (n && (n = n.filter(function (t) {
						return t.tag || rt(t)
					})).length) {
					var i = this.mode,
						o = n[0];
					if (function (t) {
							for (; t = t.parent;)
								if (t.data.transition) return !0
						}(this.$vnode)) return o;
					var a = Ye(o);
					if (!a) return o;
					if (this._leaving) return tn(t, o);
					var s = "__transition-" + this._uid + "-";
					a.key = null == a.key ? a.isComment ? s + "comment" : s + a.tag : r(a.key) ? 0 === String(a.key).indexOf(s) ? a.key : s + a.key : a.key;
					var c = (a.data || (a.data = {})).transition = Qe(this),
						u = this._vnode,
						l = Ye(u);
					if (a.data.directives && a.data.directives.some(function (t) {
							return "show" === t.name
						}) && (a.data.show = !0), l && l.data && ! function (t, e) {
							return e.key === t.key && e.tag === t.tag
						}(a, l) && !rt(l) && (!l.componentInstance || !l.componentInstance._vnode.isComment)) {
						var f = l.data.transition = h({}, c);
						if ("out-in" === i) return this._leaving = !0, Y(f, "afterLeave", function () {
							e._leaving = !1, e.$forceUpdate()
						}), tn(t, o);
						if ("in-out" === i) {
							if (rt(a)) return u;
							var p, d = function () {
								p()
							};
							Y(c, "afterEnter", d), Y(c, "enterCancelled", d), Y(f, "delayLeave", function (t) {
								p = t
							})
						}
					}
					return o
				}
			}
		},
		ao = h({
			tag: String,
			moveClass: String
		}, io);
	delete ao.mode;
	var so = {
		Transition: oo,
		TransitionGroup: {
			props: ao,
			render: function (t) {
				for (var e = this.tag || this.$vnode.data.tag || "span", n = Object.create(null), r = this.prevChildren = this.children, i = this.$slots.default || [], o = this.children = [], a = Qe(this), s = 0; s < i.length; s++) {
					var c = i[s];
					c.tag && null != c.key && 0 !== String(c.key).indexOf("__vlist") && (o.push(c), n[c.key] = c, (c.data || (c.data = {})).transition = a)
				}
				if (r) {
					for (var u = [], l = [], f = 0; f < r.length; f++) {
						var p = r[f];
						p.data.transition = a, p.data.pos = p.elm.getBoundingClientRect(), n[p.key] ? u.push(p) : l.push(p)
					}
					this.kept = t(e, null, u), this.removed = l
				}
				return t(e, null, o)
			},
			beforeUpdate: function () {
				this.__patch__(this._vnode, this.kept, !1, !0), this._vnode = this.kept
			},
			updated: function () {
				var t = this.prevChildren,
					e = this.moveClass || (this.name || "v") + "-move";
				t.length && this.hasMove(t[0].elm, e) && (t.forEach(en), t.forEach(nn), t.forEach(rn), this._reflow = document.body.offsetHeight, t.forEach(function (t) {
					if (t.data.moved) {
						var n = t.elm,
							r = n.style;
						Ie(n, e), r.transform = r.WebkitTransform = r.transitionDuration = "", n.addEventListener(Zi, n._moveCb = function t(r) {
							r && !/transform$/.test(r.propertyName) || (n.removeEventListener(Zi, t), n._moveCb = null, Le(n, e))
						})
					}
				}))
			},
			methods: {
				hasMove: function (t, e) {
					if (!Ji) return !1;
					if (this._hasMove) return this._hasMove;
					var n = t.cloneNode();
					t._transitionClasses && t._transitionClasses.forEach(function (t) {
						Ee(n, t)
					}), Te(n, e), n.style.display = "none", this.$el.appendChild(n);
					var r = De(n);
					return this.$el.removeChild(n), this._hasMove = r.hasTransform
				}
			}
		}
	};
	Rt.config.mustUseProp = fi, Rt.config.isReservedTag = $i, Rt.config.isReservedAttr = ui, Rt.config.getTagNamespace = Gt, Rt.config.isUnknownElement = function (t) {
		if (!Gn) return !0;
		if ($i(t)) return !1;
		if (t = t.toLowerCase(), null != Ci[t]) return Ci[t];
		var e = document.createElement(t);
		return t.indexOf("-") > -1 ? Ci[t] = e.constructor === window.HTMLUnknownElement || e.constructor === window.HTMLElement : Ci[t] = /HTMLUnknownElement/.test(e.toString())
	}, h(Rt.options.directives, ro), h(Rt.options.components, so), Rt.prototype.__patch__ = Gn ? eo : y, Rt.prototype.$mount = function (t, e) {
		return t = t && Gn ? Zt(t) : void 0,
			function (t, e, n) {
				t.$el = e, t.$options.render || (t.$options.render = gr), vt(t, "beforeMount");
				var r;
				return r = function () {
					t._update(t._render(), n)
				}, new Kr(t, r, y, null, !0), n = !1, null == t.$vnode && (t._isMounted = !0, vt(t, "mounted")), t
			}(this, t, e)
	}, Rt.nextTick(function () {
		Jn.devtools && lr && lr.emit("init", Rt)
	}, 0);
	var co, uo = /\{\{((?:.|\n)+?)\}\}/g,
		lo = /[-.*+?^${}()|[\]\/\\]/g,
		fo = p(function (t) {
			var e = t[0].replace(lo, "\\$&"),
				n = t[1].replace(lo, "\\$&");
			return new RegExp(e + "((?:.|\\n)+?)" + n, "g")
		}),
		po = {
			staticKeys: ["staticClass"],
			transformNode: function (t, e) {
				e.warn;
				var n = he(t, "class");
				n && (t.staticClass = JSON.stringify(n));
				var r = ve(t, "class", !1);
				r && (t.classBinding = r)
			},
			genData: function (t) {
				var e = "";
				return t.staticClass && (e += "staticClass:" + t.staticClass + ","), t.classBinding && (e += "class:" + t.classBinding + ","), e
			}
		},
		vo = {
			staticKeys: ["staticStyle"],
			transformNode: function (t, e) {
				e.warn;
				var n = he(t, "style");
				n && (t.staticStyle = JSON.stringify(Fi(n)));
				var r = ve(t, "style", !1);
				r && (t.styleBinding = r)
			},
			genData: function (t) {
				var e = "";
				return t.staticStyle && (e += "staticStyle:" + t.staticStyle + ","), t.styleBinding && (e += "style:(" + t.styleBinding + "),"), e
			}
		},
		ho = function (t) {
			return co = co || document.createElement("div"), co.innerHTML = t, co.textContent
		},
		mo = u("area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr"),
		yo = u("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source"),
		go = u("address,article,aside,base,blockquote,body,caption,col,colgroup,dd,details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,title,tr,track"),
		_o = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/,
		bo = "[a-zA-Z_][\\w\\-\\.]*",
		$o = "((?:" + bo + "\\:)?" + bo + ")",
		Co = new RegExp("^<" + $o),
		wo = /^\s*(\/?)>/,
		xo = new RegExp("^<\\/" + $o + "[^>]*>"),
		ko = /^<!DOCTYPE [^>]+>/i,
		Ao = /^<!--/,
		Oo = /^<!\[/,
		So = !1;
	"x".replace(/x(.)?/g, function (t, e) {
		So = "" === e
	});
	var To, Eo, jo, No, Io, Lo, Mo, Do, Po, Fo, Ro, Ho = u("script,style,textarea", !0),
		Bo = {},
		Uo = {
			"&lt;": "<",
			"&gt;": ">",
			"&quot;": '"',
			"&amp;": "&",
			"&#10;": "\n",
			"&#9;": "\t"
		},
		Vo = /&(?:lt|gt|quot|amp);/g,
		zo = /&(?:lt|gt|quot|amp|#10|#9);/g,
		Ko = u("pre,textarea", !0),
		Jo = function (t, e) {
			return t && Ko(t) && "\n" === e[0]
		},
		qo = /^@|^v-on:/,
		Wo = /^v-|^@|^:/,
		Go = /(.*?)\s+(?:in|of)\s+(.*)/,
		Zo = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/,
		Xo = /^\(|\)$/g,
		Yo = /:(.*)$/,
		Qo = /^:|^v-bind:/,
		ta = /\.[^.]+/g,
		ea = p(ho),
		na = /^xmlns:NS\d+/,
		ra = /^NS\d+:/,
		ia = [po, vo, {
			preTransformNode: function (t, e) {
				if ("input" === t.tag) {
					var n = t.attrsMap;
					if (n["v-model"] && (n["v-bind:type"] || n[":type"])) {
						var r = ve(t, "type"),
							i = he(t, "v-if", !0),
							o = i ? "&&(" + i + ")" : "",
							a = null != he(t, "v-else", !0),
							s = he(t, "v-else-if", !0),
							c = fn(t);
						un(c), fe(c, "type", "checkbox"), cn(c, e), c.processed = !0, c.if = "(" + r + ")==='checkbox'" + o, ln(c, {
							exp: c.if,
							block: c
						});
						var u = fn(t);
						he(u, "v-for", !0), fe(u, "type", "radio"), cn(u, e), ln(c, {
							exp: "(" + r + ")==='radio'" + o,
							block: u
						});
						var l = fn(t);
						return he(l, "v-for", !0), fe(l, ":type", r), cn(l, e), ln(c, {
							exp: i,
							block: l
						}), a ? c.else = !0 : s && (c.elseif = s), c
					}
				}
			}
		}],
		oa = {
			expectHTML: !0,
			modules: ia,
			directives: {
				model: function (t, e, n) {
					var r = e.value,
						i = e.modifiers,
						o = t.tag,
						a = t.attrsMap.type;
					if (t.component) return me(t, r, i), !1;
					if ("select" === o) ! function (t, e, n) {
						var r = 'var $$selectedVal = Array.prototype.filter.call($event.target.options,function(o){return o.selected}).map(function(o){var val = "_value" in o ? o._value : o.value;return ' + (n && n.number ? "_n(val)" : "val") + "});";
						r = r + " " + ye(e, "$event.target.multiple ? $$selectedVal : $$selectedVal[0]"), de(t, "change", r, null, !0)
					}(t, r, i);
					else if ("input" === o && "checkbox" === a) ! function (t, e, n) {
						var r = n && n.number,
							i = ve(t, "value") || "null",
							o = ve(t, "true-value") || "true",
							a = ve(t, "false-value") || "false";
						ue(t, "checked", "Array.isArray(" + e + ")?_i(" + e + "," + i + ")>-1" + ("true" === o ? ":(" + e + ")" : ":_q(" + e + "," + o + ")")), de(t, "change", "var $$a=" + e + ",$$el=$event.target,$$c=$$el.checked?(" + o + "):(" + a + ");if(Array.isArray($$a)){var $$v=" + (r ? "_n(" + i + ")" : i) + ",$$i=_i($$a,$$v);if($$el.checked){$$i<0&&(" + e + "=$$a.concat([$$v]))}else{$$i>-1&&(" + e + "=$$a.slice(0,$$i).concat($$a.slice($$i+1)))}}else{" + ye(e, "$$c") + "}", null, !0)
					}(t, r, i);
					else if ("input" === o && "radio" === a) ! function (t, e, n) {
						var r = n && n.number,
							i = ve(t, "value") || "null";
						ue(t, "checked", "_q(" + e + "," + (i = r ? "_n(" + i + ")" : i) + ")"), de(t, "change", ye(e, i), null, !0)
					}(t, r, i);
					else if ("input" === o || "textarea" === o) ! function (t, e, n) {
						var r = t.attrsMap.type,
							i = n || {},
							o = i.lazy,
							a = i.number,
							s = i.trim,
							c = !o && "range" !== r,
							u = o ? "change" : "range" === r ? Li : "input",
							l = "$event.target.value";
						s && (l = "$event.target.value.trim()"), a && (l = "_n(" + l + ")");
						var f = ye(e, l);
						c && (f = "if($event.target.composing)return;" + f), ue(t, "value", "(" + e + ")"), de(t, u, f, null, !0), (s || a) && de(t, "blur", "$forceUpdate()")
					}(t, r, i);
					else if (!Jn.isReservedTag(o)) return me(t, r, i), !1;
					return !0
				},
				text: function (t, e) {
					e.value && ue(t, "textContent", "_s(" + e.value + ")")
				},
				html: function (t, e) {
					e.value && ue(t, "innerHTML", "_s(" + e.value + ")")
				}
			},
			isPreTag: function (t) {
				return "pre" === t
			},
			isUnaryTag: mo,
			mustUseProp: fi,
			canBeLeftOpenTag: yo,
			isReservedTag: $i,
			getTagNamespace: Gt,
			staticKeys: function (t) {
				return t.reduce(function (t, e) {
					return t.concat(e.staticKeys || [])
				}, []).join(",")
			}(ia)
		},
		aa = p(function (t) {
			return u("type,tag,attrsList,attrsMap,plain,parent,children,attrs" + (t ? "," + t : ""))
		}),
		sa = /^\s*([\w$_]+|\([^)]*?\))\s*=>|^function\s*\(/,
		ca = /^\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['.*?']|\[".*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*\s*$/,
		ua = {
			esc: 27,
			tab: 9,
			enter: 13,
			space: 32,
			up: 38,
			left: 37,
			right: 39,
			down: 40,
			delete: [8, 46]
		},
		la = function (t) {
			return "if(" + t + ")return null;"
		},
		fa = {
			stop: "$event.stopPropagation();",
			prevent: "$event.preventDefault();",
			self: la("$event.target !== $event.currentTarget"),
			ctrl: la("!$event.ctrlKey"),
			shift: la("!$event.shiftKey"),
			alt: la("!$event.altKey"),
			meta: la("!$event.metaKey"),
			left: la("'button' in $event && $event.button !== 0"),
			middle: la("'button' in $event && $event.button !== 1"),
			right: la("'button' in $event && $event.button !== 2")
		},
		pa = {
			on: function (t, e) {
				t.wrapListeners = function (t) {
					return "_g(" + t + "," + e.value + ")"
				}
			},
			bind: function (t, e) {
				t.wrapData = function (n) {
					return "_b(" + n + ",'" + t.tag + "'," + e.value + "," + (e.modifiers && e.modifiers.prop ? "true" : "false") + (e.modifiers && e.modifiers.sync ? ",true" : "") + ")"
				}
			},
			cloak: y
		},
		da = function (t) {
			this.options = t, this.warn = t.warn || se, this.transforms = ce(t.modules, "transformCode"), this.dataGenFns = ce(t.modules, "genData"), this.directives = h(h({}, pa), t.directives);
			var e = t.isReservedTag || Bn;
			this.maybeComponent = function (t) {
				return !e(t.tag)
			}, this.onceId = 0, this.staticRenderFns = []
		},
		va = (new RegExp("\\b" + "do,if,for,let,new,try,var,case,else,with,await,break,catch,class,const,super,throw,while,yield,delete,export,import,return,switch,default,extends,finally,continue,debugger,function,arguments".split(",").join("\\b|\\b") + "\\b"), new RegExp("\\b" + "delete,typeof,void".split(",").join("\\s*\\([^\\)]*\\)|\\b") + "\\s*\\([^\\)]*\\)"), function (t) {
			return function (e) {
				function n(n, r) {
					var i = Object.create(e),
						o = [],
						a = [];
					if (i.warn = function (t, e) {
							(e ? a : o).push(t)
						}, r) {
						r.modules && (i.modules = (e.modules || []).concat(r.modules)), r.directives && (i.directives = h(Object.create(e.directives || null), r.directives));
						for (var s in r) "modules" !== s && "directives" !== s && (i[s] = r[s])
					}
					var c = t(n, i);
					return c.errors = o, c.tips = a, c
				}
				return {
					compile: n,
					compileToFunctions: function (t) {
						var e = Object.create(null);
						return function (n, r, i) {
							(r = h({}, r)).warn, delete r.warn;
							var o = r.delimiters ? String(r.delimiters) + n : n;
							if (e[o]) return e[o];
							var a = t(n, r),
								s = {},
								c = [];
							return s.render = Tn(a.render, c), s.staticRenderFns = a.staticRenderFns.map(function (t) {
								return Tn(t, c)
							}), e[o] = s
						}
					}(n)
				}
			}
		}(function (t, e) {
			var n = sn(t.trim(), e);
			!1 !== e.optimize && function (t, e) {
				t && (Po = aa(e.staticKeys || ""), Fo = e.isReservedTag || Bn, pn(t), dn(t, !1))
			}(n, e);
			var r = yn(n, e);
			return {
				ast: n,
				render: r.render,
				staticRenderFns: r.staticRenderFns
			}
		})(oa).compileToFunctions),
		ha = !!Gn && En(!1),
		ma = !!Gn && En(!0),
		ya = p(function (t) {
			var e = Zt(t);
			return e && e.innerHTML
		}),
		ga = Rt.prototype.$mount;
	return Rt.prototype.$mount = function (t, e) {
		if ((t = t && Zt(t)) === document.body || t === document.documentElement) return this;
		var n = this.$options;
		if (!n.render) {
			var r = n.template;
			if (r)
				if ("string" == typeof r) "#" === r.charAt(0) && (r = ya(r));
				else {
					if (!r.nodeType) return this;
					r = r.innerHTML
				}
			else t && (r = function (t) {
				if (t.outerHTML) return t.outerHTML;
				var e = document.createElement("div");
				return e.appendChild(t.cloneNode(!0)), e.innerHTML
			}(t));
			if (r) {
				var i = va(r, {
						shouldDecodeNewlines: ha,
						shouldDecodeNewlinesForHref: ma,
						delimiters: n.delimiters,
						comments: n.comments
					}, this),
					o = i.render,
					a = i.staticRenderFns;
				n.render = o, n.staticRenderFns = a
			}
		}
		return ga.call(this, t, e)
	}, Rt.compile = va, Rt
});;;
(function () {
	'use strict';
	var Vuebar = {};
	Vuebar.install = function (Vue, options) {
		function createState(el) {
			el._vuebarState = {
				config: {
					scrollThrottle: 10,
					draggerThrottle: 10,
					resizeRefresh: true,
					observerThrottle: 100,
					resizeDebounce: 100,
					unselectableBody: true,
					overrideFloatingScrollbar: true,
					scrollingPhantomDelay: 1000,
					draggingPhantomDelay: 1000,
					preventParentScroll: false,
					useScrollbarPseudo: false,
					el1Class: 'vb',
					el1ScrollVisibleClass: 'vb-visible',
					el1ScrollInvisibleClass: 'vb-invisible',
					el1ScrollingClass: 'vb-scrolling',
					el1ScrollingPhantomClass: 'vb-scrolling-phantom',
					el1DraggingClass: 'vb-dragging',
					el1DraggingPhantomClass: 'vb-dragging-phantom',
					el2Class: 'vb-content',
					draggerClass: 'vb-dragger',
					draggerStylerClass: 'vb-dragger-styler',
				},
				binding: null,
				el1: null,
				el2: null,
				dragger: null,
				draggerEnabled: null,
				visibleArea: 0,
				scrollTop: 0,
				barTop: 0,
				barHeight: 0,
				mouseBarOffsetY: 0,
				barDragging: false,
				mutationObserver: null,
				scrollingClassTimeout: null,
				draggingClassTimeout: null,
				scrollingPhantomClassTimeout: null,
				draggingPhantomClassTimeout: null,
				barMousedown: null,
				documentMousemove: null,
				documentMouseup: null,
				windowResize: null,
				scrollHandler: null,
				wheelHandler: null,
			};
			return el._vuebarState;
		}

		function getState(el) {
			return el._vuebarState;
		}

		function markupValidation(el) {
			if (!el.firstChild) {
				Vue.util.warn('(Vuebar) Element 1 with v-bar directive doesn\'t have required child element 2.');
				return false;
			}
			return true;
		}

		function computeVisibleArea(el) {
			var state = getState(el);
			state.visibleArea = (state.el2.clientHeight / state.el2.scrollHeight);
		}

		function computeScrollTop(el) {
			var state = getState(el);
			state.scrollTop = state.barTop * (state.el2.scrollHeight / state.el2.clientHeight);
		}

		function computeBarTop(el, event) {
			var state = getState(el);
			if (!event) {
				state.barTop = state.el2.scrollTop * state.visibleArea;
				return false;
			}
			var relativeMouseY = (event.clientY - state.el1.getBoundingClientRect().top);
			if (relativeMouseY <= state.mouseBarOffsetY) {
				state.barTop = 0;
			}
			if (relativeMouseY > state.mouseBarOffsetY) {
				state.barTop = relativeMouseY - state.mouseBarOffsetY;
			}
			if ((state.barTop + state.barHeight) >= state.el2.clientHeight) {
				state.barTop = state.el2.clientHeight - state.barHeight;
			}
		}

		function computeBarHeight(el) {
			var state = getState(el);
			if (state.visibleArea >= 1) {
				state.barHeight = 0;
			} else {
				state.barHeight = state.el2.clientHeight * state.visibleArea;
			}
		}

		function createDragger(el) {
			var state = getState(el);
			var dragger = document.createElement('div');
			var draggerStyler = document.createElement('div');
			dragger.className = state.config.draggerClass;
			dragger.style.position = 'absolute';
			if (!state.draggerEnabled) {
				dragger.style.display = 'none';
			}
			draggerStyler.className = state.config.draggerStylerClass;
			dragger.appendChild(draggerStyler);
			state.el1.appendChild(dragger);
			return dragger;
		}

		function updateDragger(el, options) {
			var options = options ? options : {};
			var state = getState(el);
			state.dragger.style.height = parseInt(Math.round(state.barHeight)) + 'px';
			state.dragger.style.top = parseInt(Math.round(state.barTop)) + 'px';
			if (state.draggerEnabled && (state.visibleArea < 1)) {
				removeClass(state.el1, state.config.el1ScrollInvisibleClass);
				addClass(state.el1, state.config.el1ScrollVisibleClass);
			} else {
				removeClass(state.el1, state.config.el1ScrollVisibleClass);
				addClass(state.el1, state.config.el1ScrollInvisibleClass);
			}
			if (options.withScrollingClasses) {
				addClass(state.el1, state.config.el1ScrollingClass);
				state.scrollingClassTimeout ? clearTimeout(state.scrollingClassTimeout) : null;
				state.scrollingClassTimeout = setTimeout(function () {
					removeClass(state.el1, state.config.el1ScrollingClass);
				}, state.config.scrollThrottle + 5);
				addClass(state.el1, state.config.el1ScrollingPhantomClass);
				state.scrollingPhantomClassTimeout ? clearTimeout(state.scrollingPhantomClassTimeout) : null;
				state.scrollingPhantomClassTimeout = setTimeout(function () {
					removeClass(state.el1, state.config.el1ScrollingPhantomClass);
				}, state.config.scrollThrottle + state.config.scrollingPhantomDelay);
			}
		}

		function hideScrollbarUsingPseudoElement(el) {
			var state = getState(el);
			var idName = 'vuebar-pseudo-element-styles';
			var selector = '.' + state.config.el2Class + '::-webkit-scrollbar';
			var styleElm = document.getElementById(idName);
			var sheet = null;
			if (styleElm) {
				sheet = styleElm.sheet;
			} else {
				styleElm = document.createElement('style');
				styleElm.id = idName;
				document.head.appendChild(styleElm);
				sheet = styleElm.sheet;
			}
			var ruleExists = false;
			for (var i = 0, l = sheet.rules.length; i < l; i++) {
				var rule = sheet.rules[i];
				if (rule.selectorText == selector) {
					ruleExists = true;
				}
			}
			if (ruleExists) {
				return false
			}
			if (sheet.insertRule) {
				sheet.insertRule(selector + '{display:none}', 0);
			}
		}

		function preventParentScroll(el, event) {
			var state = getState(el);
			if (state.visibleArea >= 1) {
				return false;
			}
			var scrollDist = state.el2.scrollHeight - state.el2.clientHeight;
			var scrollTop = state.el2.scrollTop;
			var wheelingUp = event.deltaY < 0;
			var wheelingDown = event.deltaY > 0;
			if ((scrollTop <= 0) && wheelingUp) {
				event.preventDefault();
				return false;
			}
			if ((scrollTop >= scrollDist) && wheelingDown) {
				event.preventDefault();
				return false;
			}
		}

		function updateScroll(el) {
			var state = getState(el);
			state.el2.scrollTop = state.scrollTop;
		}

		function refreshScrollbar(el, options) {
			var options = options ? options : {};
			if (options.immediate) {
				computeVisibleArea(el);
				computeBarTop(el);
				computeBarHeight(el);
				updateDragger(el);
			}
			Vue.nextTick(function () {
				if (!getState(el)) {
					return false
				}
				computeVisibleArea(el);
				computeBarTop(el);
				computeBarHeight(el);
				updateDragger(el);
			}.bind(this));
		}

		function scrollHandler(el) {
			var state = getState(el);
			return throttle(function (event) {
				computeVisibleArea(el);
				computeBarHeight(el);
				if (!state.barDragging) {
					computeBarTop(el);
					updateDragger(el, {
						withScrollingClasses: true
					});
				}
			}.bind(this), state.config.scrollThrottle);
		}

		function wheelHandler(el) {
			return function (event) {
				preventParentScroll(el, event);
			}.bind(this);
		}

		function documentMousemove(el) {
			var state = getState(el);
			return throttle(function (event) {
				computeBarTop(el, event);
				updateDragger(el);
				computeScrollTop(el);
				updateScroll(el);
			}.bind(this), state.config.draggerThrottle);
		}

		function documentMouseup(el) {
			var state = getState(el);
			return function (event) {
				state.barDragging = false;
				state.el1.style.userSelect = '';
				state.config.unselectableBody ? compatStyle(document.body, 'UserSelect', '') : null;
				removeClass(state.el1, state.config.el1DraggingClass);
				state.draggingPhantomClassTimeout = setTimeout(function () {
					removeClass(state.el1, state.config.el1DraggingPhantomClass);
				}, state.config.draggingPhantomDelay);
				document.removeEventListener('mousemove', state.documentMousemove, 0);
				document.removeEventListener('mouseup', state.documentMouseup, 0);
			}.bind(this);
		}

		function barMousedown(el) {
			var state = getState(el);
			return function (event) {
				if (event.which !== 1) {
					return false
				}
				state.barDragging = true;
				state.mouseBarOffsetY = event.offsetY;
				state.el1.style.userSelect = 'none';
				state.config.unselectableBody ? compatStyle(document.body, 'UserSelect', 'none') : null;
				addClass(state.el1, state.config.el1DraggingClass);
				state.draggingPhantomClassTimeout ? clearTimeout(state.draggingPhantomClassTimeout) : null;
				addClass(state.el1, state.config.el1DraggingPhantomClass);
				document.addEventListener('mousemove', state.documentMousemove, 0);
				document.addEventListener('mouseup', state.documentMouseup, 0);
			}.bind(this);
		}

		function windowResize(el) {
			var state = getState(el);
			return debounce(function (event) {
				refreshScrollbar(el);
			}.bind(this), state.config.resizeDebounce);
		}

		function initMutationObserver(el) {
			if (typeof MutationObserver === typeof void 0) {
				return null
			}
			var state = getState(el);
			var observer = new MutationObserver(throttle(function (mutations) {
				refreshScrollbar(el);
			}, state.config.observerThrottle));
			observer.observe(state.el2, {
				childList: true,
				characterData: true,
				subtree: true,
			});
			return observer;
		}

		function initScrollbar(el, kwargs) {
			if (!markupValidation.call(this, el)) {
				return false
			}
			if (el._vuebarState) {
				Vue.util.warn('(Vuebar) Tried to initialize second time. If you see this please create an issue on https://github.com/DominikSerafin/vuebar with all relevent debug information. Thank you!');
				return false;
			}
			var state = createState(el);
			var options = kwargs.value ? kwargs.value : (kwargs ? kwargs : {});
			for (var key in options) {
				state.config[key] = options[key];
			}
			var browser = detectBrowser();
			var elNativeScrollbarWidth = getNativeScrollbarWidth(el.firstElementChild);
			var overlayScrollbar = elNativeScrollbarWidth == 0;
			state.draggerEnabled = ((!overlayScrollbar) || state.config.overrideFloatingScrollbar) ? 1 : 0;
			state.binding = kwargs.value ? kwargs : null;
			state.el1 = el;
			state.el2 = el.firstElementChild;
			state.dragger = createDragger(el);
			state.barMousedown = barMousedown(el);
			state.documentMousemove = documentMousemove(el);
			state.documentMouseup = documentMouseup(el);
			state.windowResize = windowResize(el);
			state.scrollHandler = scrollHandler(el);
			state.wheelHandler = wheelHandler(el);
			state.mutationObserver = initMutationObserver(el);
			addClass(state.el1, state.config.el1Class);
			state.el1.style.position = 'relative';
			state.el1.style.overflow = 'hidden';
			addClass(state.el2, state.config.el2Class);
			state.el2.style.display = 'block';
			state.el2.style.overflowX = 'hidden';
			state.el2.style.overflowY = 'scroll';
			state.el2.style.height = '100%';
			if (state.draggerEnabled) {
				if (state.config.useScrollbarPseudo && (browser.chrome || browser.safari)) {
					state.el2.style.width = '100%';
					hideScrollbarUsingPseudoElement(el);
				} else if (overlayScrollbar) {
					state.el2.style.width = '100%';
					compatStyle(state.el2, 'BoxSizing', 'content-box');
					state.el2.style.paddingRight = '20px';
				} else {
					state.el2.style.width = 'calc(100% + ' + elNativeScrollbarWidth + 'px)';
				}
			}
			state.el2.addEventListener('scroll', state.scrollHandler, 0);
			state.dragger.addEventListener('mousedown', state.barMousedown, 0);
			state.config.preventParentScroll ? state.el2.addEventListener('wheel', state.wheelHandler, 0) : null;
			state.config.resizeRefresh ? window.addEventListener('resize', state.windowResize, 0) : null;
			refreshScrollbar(el, {
				immediate: true
			});
		}

		function destroyScrollbar(el, options) {
			var options = options ? options : {};
			var state = getState(el);
			state.dragger.removeEventListener('mousedown', state.barMousedown, 0);
			state.el2.removeEventListener('scroll', state.scrollHandler, 0);
			state.el2.removeEventListener('wheel', state.scrollHandler, 0);
			window.removeEventListener('resize', state.windowResize, 0);
			state.mutationObserver ? state.mutationObserver.disconnect() : null;
			removeClass(state.el1, state.config.el1Class);
			removeClass(state.el1, state.config.el1ScrollVisibleClass);
			removeClass(state.el1, state.config.el1ScrollInvisibleClass);
			removeClass(state.el1, state.config.el1ScrollingClass);
			removeClass(state.el1, state.config.el1ScrollingPhantomClass);
			removeClass(state.el1, state.config.el1DraggingClass);
			if (options.clearStyles) {
				state.el1.style.position = '';
				state.el1.style.overflow = '';
			}
			removeClass(state.el2, state.config.el2Class);
			if (options.clearStyles) {
				state.el2.style.display = '';
				state.el2.style.overflowX = '';
				state.el2.style.overflowY = '';
				state.el2.style.msOverflowStyle = '';
				state.el2.style.height = '';
				state.el2.style.width = '';
			}
			state.dragger.removeChild(state.dragger.firstChild);
			state.el1.removeChild(state.dragger);
			state.scrollingPhantomClassTimeout ? clearTimeout(state.scrollingPhantomClassTimeout) : null;
			state.draggingPhantomClassTimeout ? clearTimeout(state.draggingPhantomClassTimeout) : null;
			delete el._vuebarState;
		}

		function publicMethods() {
			return {
				getState: getState,
				initScrollbar: initScrollbar,
				destroyScrollbar: destroyScrollbar,
				refreshScrollbar: refreshScrollbar,
			};
		}
		Vue.vuebar = publicMethods();
		Vue.prototype.$vuebar = publicMethods();
		Vue.directive('bar', {
			inserted: function (el, binding, vnode) {
				initScrollbar.call(this, el, binding);
			},
			componentUpdated: function (el, binding, vnode, oldVnode) {
				refreshScrollbar.call(this, el);
			},
			unbind: function (el, binding, vnode, oldVnode) {
				destroyScrollbar.call(this, el, {
					clearStyles: false
				});
			},
		});

		function debounce(fn, delay) {
			var timer = null;
			return function () {
				var context = this,
					args = arguments;
				clearTimeout(timer);
				timer = setTimeout(function () {
					fn.apply(context, args);
				}, delay);
			};
		};

		function throttle(fn, threshhold, scope) {
			threshhold || (threshhold = 250);
			var last, deferTimer;
			return function () {
				var context = scope || this;
				var now = +new Date,
					args = arguments;
				if (last && now < last + threshhold) {
					clearTimeout(deferTimer);
					deferTimer = setTimeout(function () {
						last = now;
						fn.apply(context, args);
					}, threshhold);
				} else {
					last = now;
					fn.apply(context, args);
				}
			}
		}

		function compatStyle(element, property, value) {
			element.style['webkit' + property] = value;
			element.style['moz' + property] = value;
			element.style['ms' + property] = value;
			element.style['o' + property] = value;
			element.style[property.slice(0, 1).toLowerCase() + property.substring(1)] = value;
		}

		function hasClass(el, className) {
			return el.classList ? el.classList.contains(className) : new RegExp('\\b' + className + '\\b').test(el.className);
		}

		function addClass(el, className) {
			if (el.classList) el.classList.add(className);
			else if (!hasClass(el, className)) el.className += ' ' + className;
		}

		function removeClass(el, className) {
			if (el.classList) el.classList.remove(className);
			else el.className = el.className.replace(new RegExp('\\b' + className + '\\b', 'g'), '');
		}

		function detectBrowser() {
			function getIEVersion() {
				var match = window.navigator.userAgent.match(/(?:MSIE |Trident\/.*; rv:)(\d+)/);
				return match ? parseInt(match[1]) : void 0;
			}
			var ua = window.navigator.userAgent;
			var vendor = window.navigator.vendor;
			var chrome = ((ua.toLowerCase().indexOf('chrome') > -1) && (vendor.toLowerCase().indexOf('google') > -1));
			var edge = ua.indexOf('Edge') > -1;
			var safari = !!window.safari || ((ua.toLowerCase().indexOf('safari') > -1) && (vendor.toLowerCase().indexOf('apple') > -1));
			var ie8 = getIEVersion() == 8;
			var ie9 = getIEVersion() == 9;
			var ie10 = getIEVersion() == 10;
			var ie11 = getIEVersion() == 11;
			var ie = ie8 || ie9 || ie10 || ie11;
			var uaOrVendor = ua || vendor || window.opera;
			var mobile = (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(uaOrVendor) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(uaOrVendor.substr(0, 4)));
			return {
				edge: edge,
				chrome: chrome,
				safari: safari,
				mobile: mobile,
				ie: ie,
				ie8: ie8,
				ie9: ie9,
				ie10: ie10,
				ie11: ie11,
			};
		}

		function getNativeScrollbarWidth(container) {
			var container = container ? container : document.body;
			var fullWidth = 0;
			var barWidth = 0;
			var wrapper = document.createElement('div');
			var child = document.createElement('div');
			wrapper.style.position = 'absolute';
			wrapper.style.pointerEvents = 'none';
			wrapper.style.bottom = '0';
			wrapper.style.right = '0';
			wrapper.style.width = '100px';
			wrapper.style.overflow = 'hidden';
			wrapper.appendChild(child);
			container.appendChild(wrapper);
			fullWidth = child.offsetWidth;
			child.style.width = '100%';
			wrapper.style.overflowY = 'scroll';
			barWidth = fullWidth - child.offsetWidth;
			container.removeChild(wrapper);
			return barWidth;
		}
	};
	if (typeof exports === 'object' && typeof module === 'object') {
		module.exports = Vuebar;
	} else if (typeof define === 'function' && define.amd) {
		define(function () {
			return Vuebar
		});
	} else if (typeof window !== typeof void 0) {
		window.Vuebar = Vuebar;
	}
	if (typeof Vue !== typeof void 0) {
		Vue.use(Vuebar);
	}
})();;
! function (root, factory) {
	"object" == typeof exports && "object" == typeof module ? module.exports = factory() : "function" == typeof define && define.amd ? define([], factory) : "object" == typeof exports ? exports["vue-js-modal"] = factory() : root["vue-js-modal"] = factory();
}(this, function () {
	return function (modules) {
		function __webpack_require__(moduleId) {
			if (installedModules[moduleId]) return installedModules[moduleId].exports;
			var module = installedModules[moduleId] = {
				i: moduleId,
				l: !1,
				exports: {}
			};
			return modules[moduleId].call(module.exports, module, module.exports, __webpack_require__), module.l = !0, module.exports;
		}
		var installedModules = {};
		return __webpack_require__.m = modules, __webpack_require__.c = installedModules, __webpack_require__.i = function (value) {
			return value;
		}, __webpack_require__.d = function (exports, name, getter) {
			__webpack_require__.o(exports, name) || Object.defineProperty(exports, name, {
				configurable: !1,
				enumerable: !0,
				get: getter
			});
		}, __webpack_require__.n = function (module) {
			var getter = module && module.__esModule ? function () {
				return module.default;
			} : function () {
				return module;
			};
			return __webpack_require__.d(getter, "a", getter), getter;
		}, __webpack_require__.o = function (object, property) {
			return Object.prototype.hasOwnProperty.call(object, property);
		}, __webpack_require__.p = "/dist/", __webpack_require__(__webpack_require__.s = 3);
	}([function (module, exports) {
		module.exports = function (rawScriptExports, compiledTemplate, scopeId, cssModules) {
			var esModule, scriptExports = rawScriptExports = rawScriptExports || {},
				type = typeof rawScriptExports.default;
			"object" !== type && "function" !== type || (esModule = rawScriptExports, scriptExports = rawScriptExports.default);
			var options = "function" == typeof scriptExports ? scriptExports.options : scriptExports;
			if (compiledTemplate && (options.render = compiledTemplate.render, options.staticRenderFns = compiledTemplate.staticRenderFns), scopeId && (options._scopeId = scopeId), cssModules) {
				var computed = options.computed || (options.computed = {});
				Object.keys(cssModules).forEach(function (key) {
					var module = cssModules[key];
					computed[key] = function () {
						return module;
					};
				});
			}
			return {
				esModule: esModule,
				exports: scriptExports,
				options: options
			};
		};
	}, function (module, exports) {
		module.exports = function () {
			var list = [];
			return list.toString = function () {
				for (var result = [], i = 0; i < this.length; i++) {
					var item = this[i];
					item[2] ? result.push("@media " + item[2] + "{" + item[1] + "}") : result.push(item[1]);
				}
				return result.join("");
			}, list.i = function (modules, mediaQuery) {
				"string" == typeof modules && (modules = [
					[null, modules, ""]
				]);
				for (var alreadyImportedModules = {}, i = 0; i < this.length; i++) {
					var id = this[i][0];
					"number" == typeof id && (alreadyImportedModules[id] = !0);
				}
				for (i = 0; i < modules.length; i++) {
					var item = modules[i];
					"number" == typeof item[0] && alreadyImportedModules[item[0]] || (mediaQuery && !item[2] ? item[2] = mediaQuery : mediaQuery && (item[2] = "(" + item[2] + ") and (" + mediaQuery + ")"), list.push(item));
				}
			}, list;
		};
	}, function (module, exports, __webpack_require__) {
		function addStylesToDom(styles) {
			for (var i = 0; i < styles.length; i++) {
				var item = styles[i],
					domStyle = stylesInDom[item.id];
				if (domStyle) {
					domStyle.refs++;
					for (var j = 0; j < domStyle.parts.length; j++) domStyle.parts[j](item.parts[j]);
					for (; j < item.parts.length; j++) domStyle.parts.push(addStyle(item.parts[j]));
					domStyle.parts.length > item.parts.length && (domStyle.parts.length = item.parts.length);
				} else {
					for (var parts = [], j = 0; j < item.parts.length; j++) parts.push(addStyle(item.parts[j]));
					stylesInDom[item.id] = {
						id: item.id,
						refs: 1,
						parts: parts
					};
				}
			}
		}

		function createStyleElement() {
			var styleElement = document.createElement("style");
			return styleElement.type = "text/css", head.appendChild(styleElement), styleElement;
		}

		function addStyle(obj) {
			var update, remove, styleElement = document.querySelector('style[data-vue-ssr-id~="' + obj.id + '"]');
			if (styleElement) {
				if (isProduction) return noop;
				styleElement.parentNode.removeChild(styleElement);
			}
			if (isOldIE) {
				var styleIndex = singletonCounter++;
				styleElement = singletonElement || (singletonElement = createStyleElement()), update = applyToSingletonTag.bind(null, styleElement, styleIndex, !1), remove = applyToSingletonTag.bind(null, styleElement, styleIndex, !0);
			} else styleElement = createStyleElement(), update = applyToTag.bind(null, styleElement), remove = function () {
				styleElement.parentNode.removeChild(styleElement);
			};
			return update(obj),
				function (newObj) {
					if (newObj) {
						if (newObj.css === obj.css && newObj.media === obj.media && newObj.sourceMap === obj.sourceMap) return;
						update(obj = newObj);
					} else remove();
				};
		}

		function applyToSingletonTag(styleElement, index, remove, obj) {
			var css = remove ? "" : obj.css;
			if (styleElement.styleSheet) styleElement.styleSheet.cssText = replaceText(index, css);
			else {
				var cssNode = document.createTextNode(css),
					childNodes = styleElement.childNodes;
				childNodes[index] && styleElement.removeChild(childNodes[index]), childNodes.length ? styleElement.insertBefore(cssNode, childNodes[index]) : styleElement.appendChild(cssNode);
			}
		}

		function applyToTag(styleElement, obj) {
			var css = obj.css,
				media = obj.media,
				sourceMap = obj.sourceMap;
			if (media && styleElement.setAttribute("media", media), sourceMap && (css += "\n/*# sourceURL=" + sourceMap.sources[0] + " */", css += "\n/*# sourceMappingURL=data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))) + " */"), styleElement.styleSheet) styleElement.styleSheet.cssText = css;
			else {
				for (; styleElement.firstChild;) styleElement.removeChild(styleElement.firstChild);
				styleElement.appendChild(document.createTextNode(css));
			}
		}
		var hasDocument = "undefined" != typeof document;
		if ("undefined" != typeof DEBUG && DEBUG && !hasDocument) throw new Error("vue-style-loader cannot be used in a non-browser environment. Use { target: 'node' } in your Webpack config to indicate a server-rendering environment.");
		var listToStyles = __webpack_require__(24),
			stylesInDom = {},
			head = hasDocument && (document.head || document.getElementsByTagName("head")[0]),
			singletonElement = null,
			singletonCounter = 0,
			isProduction = !1,
			noop = function () {},
			isOldIE = "undefined" != typeof navigator && /msie [6-9]\b/.test(navigator.userAgent.toLowerCase());
		module.exports = function (parentId, list, _isProduction) {
			isProduction = _isProduction;
			var styles = listToStyles(parentId, list);
			return addStylesToDom(styles),
				function (newList) {
					for (var mayRemove = [], i = 0; i < styles.length; i++) {
						var item = styles[i],
							domStyle = stylesInDom[item.id];
						domStyle.refs--, mayRemove.push(domStyle);
					}
					newList ? (styles = listToStyles(parentId, newList), addStylesToDom(styles)) : styles = [];
					for (var i = 0; i < mayRemove.length; i++) {
						var domStyle = mayRemove[i];
						if (0 === domStyle.refs) {
							for (var j = 0; j < domStyle.parts.length; j++) domStyle.parts[j]();
							delete stylesInDom[domStyle.id];
						}
					}
				};
		};
		var replaceText = function () {
			var textStore = [];
			return function (index, replacement) {
				return textStore[index] = replacement, textStore.filter(Boolean).join("\n");
			};
		}();
	}, function (module, exports, __webpack_require__) {
		"use strict";

		function _interopRequireDefault(obj) {
			return obj && obj.__esModule ? obj : {
				default: obj
			};
		}
		Object.defineProperty(exports, "__esModule", {
			value: !0
		});
		var _Modal = __webpack_require__(6),
			_Modal2 = _interopRequireDefault(_Modal),
			_Dialog = __webpack_require__(5),
			_Dialog2 = _interopRequireDefault(_Dialog),
			_ModalsContainer = __webpack_require__(7),
			_ModalsContainer2 = _interopRequireDefault(_ModalsContainer),
			Plugin = {
				install: function (Vue) {
					var options = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
					this.installed || (this.installed = !0, this.event = new Vue(), this.dynamicContainer = null, this.componentName = options.componentName || "modal", Vue.prototype.$modal = {
						_setDynamicContainer: function (dynamicContainer) {
							Plugin.dynamicContainer = dynamicContainer;
						},
						show: function (modal, paramsOrProps, params) {
							"string" == typeof modal ? Plugin.event.$emit("toggle", modal, !0, paramsOrProps) : null === Plugin.dynamicContainer ? console.warn("[vue-js-modal] In order to render dynamic modals, a <modals-container> component must be present on the page") : Plugin.dynamicContainer.add(modal, paramsOrProps, params);
						},
						hide: function (name, params) {
							Plugin.event.$emit("toggle", name, !1, params);
						},
						toggle: function (name, params) {
							Plugin.event.$emit("toggle", name, void 0, params);
						}
					}, Vue.component(this.componentName, _Modal2.default), options.dialog && Vue.component("v-dialog", _Dialog2.default), options.dynamic && Vue.component("modals-container", _ModalsContainer2.default));
				}
			};
		exports.default = Plugin;
	}, function (module, exports, __webpack_require__) {
		"use strict";
		Object.defineProperty(exports, "__esModule", {
			value: !0
		});
		var inRange = exports.inRange = function (from, to, value) {
			return value < from ? from : value > to ? to : value;
		};
		exports.default = {
			inRange: inRange
		};
	}, function (module, exports, __webpack_require__) {
		__webpack_require__(21);
		var Component = __webpack_require__(0)(__webpack_require__(8), __webpack_require__(18), null, null);
		Component.options.__file = "D:\\Projects\\vue\\vue-js-modal\\src\\Dialog.vue", Component.esModule && Object.keys(Component.esModule).some(function (key) {
			return "default" !== key && "__esModule" !== key;
		}) && console.error("named exports are not supported in *.vue files."), Component.options.functional && console.error("[vue-loader] Dialog.vue: functional components are not supported with templates, they should use render functions."), module.exports = Component.exports;
	}, function (module, exports, __webpack_require__) {
		__webpack_require__(22);
		var Component = __webpack_require__(0)(__webpack_require__(9), __webpack_require__(19), null, null);
		Component.options.__file = "D:\\Projects\\vue\\vue-js-modal\\src\\Modal.vue", Component.esModule && Object.keys(Component.esModule).some(function (key) {
			return "default" !== key && "__esModule" !== key;
		}) && console.error("named exports are not supported in *.vue files."), Component.options.functional && console.error("[vue-loader] Modal.vue: functional components are not supported with templates, they should use render functions."), module.exports = Component.exports;
	}, function (module, exports, __webpack_require__) {
		var Component = __webpack_require__(0)(__webpack_require__(10), __webpack_require__(17), null, null);
		Component.options.__file = "D:\\Projects\\vue\\vue-js-modal\\src\\ModalsContainer.vue", Component.esModule && Object.keys(Component.esModule).some(function (key) {
			return "default" !== key && "__esModule" !== key;
		}) && console.error("named exports are not supported in *.vue files."), Component.options.functional && console.error("[vue-loader] ModalsContainer.vue: functional components are not supported with templates, they should use render functions."), module.exports = Component.exports;
	}, function (module, exports, __webpack_require__) {
		"use strict";
		Object.defineProperty(exports, "__esModule", {
			value: !0
		}), exports.default = {
			name: "VueJsDialog",
			props: {
				width: {
					type: [Number, String],
					default: 400
				},
				clickToClose: {
					type: Boolean,
					default: !0
				},
				transition: {
					type: String,
					default: "fade"
				}
			},
			data: function () {
				return {
					params: {},
					defaultButtons: [{
						title: "CLOSE"
					}]
				};
			},
			computed: {
				buttons: function () {
					return this.params.buttons || this.defaultButtons;
				},
				buttonStyle: function () {
					return {
						flex: "1 1 " + 100 / this.buttons.length + "%"
					};
				}
			},
			methods: {
				beforeOpened: function (event) {
					window.addEventListener("keyup", this.onKeyUp), this.params = event.params || {}, this.$emit("before-opened", event);
				},
				beforeClosed: function (event) {
					window.removeEventListener("keyup", this.onKeyUp), this.params = {}, this.$emit("before-closed", event);
				},
				click: function (i, event) {
					var source = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "click",
						button = this.buttons[i];
					button && "function" == typeof button.handler ? button.handler(i, event, {
						source: source
					}) : this.$modal.hide("dialog");
				},
				onKeyUp: function (event) {
					if (13 === event.which && this.buttons.length > 0) {
						var buttonIndex = 1 === this.buttons.length ? 0 : this.buttons.findIndex(function (button) {
							return button.default;
						}); - 1 !== buttonIndex && this.click(buttonIndex, event, "keypress");
					}
				}
			}
		};
	}, function (module, exports, __webpack_require__) {
		"use strict";

		function _interopRequireDefault(obj) {
			return obj && obj.__esModule ? obj : {
				default: obj
			};
		}
		Object.defineProperty(exports, "__esModule", {
			value: !0
		});
		var _index = __webpack_require__(3),
			_index2 = _interopRequireDefault(_index),
			_Resizer = __webpack_require__(16),
			_Resizer2 = _interopRequireDefault(_Resizer),
			_util = __webpack_require__(4),
			_parser = __webpack_require__(12),
			_parser2 = _interopRequireDefault(_parser);
		exports.default = {
			name: "VueJsModal",
			props: {
				name: {
					required: !0,
					type: String
				},
				delay: {
					type: Number,
					default: 0
				},
				resizable: {
					type: Boolean,
					default: !1
				},
				adaptive: {
					type: Boolean,
					default: !1
				},
				draggable: {
					type: [Boolean, String],
					default: !1
				},
				scrollable: {
					type: Boolean,
					default: !1
				},
				reset: {
					type: Boolean,
					default: !1
				},
				transition: {
					type: String
				},
				clickToClose: {
					type: Boolean,
					default: !0
				},
				classes: {
					type: [String, Array],
					default: "v--modal"
				},
				minWidth: {
					type: Number,
					default: 0,
					validator: function (value) {
						return value >= 0;
					}
				},
				minHeight: {
					type: Number,
					default: 0,
					validator: function (value) {
						return value >= 0;
					}
				},
				maxWidth: {
					type: Number,
					default: 1 / 0
				},
				maxHeight: {
					type: Number,
					default: 1 / 0
				},
				width: {
					type: [Number, String],
					default: 600,
					validator: function (value) {
						if ("string" == typeof value) {
							var width = (0, _parser2.default)(value);
							return ("%" === width.type || "px" === width.type) && width.value > 0;
						}
						return value >= 0;
					}
				},
				height: {
					type: [Number, String],
					default: 300,
					validator: function (value) {
						if ("string" == typeof value) {
							if ("auto" === value) return !0;
							var height = (0, _parser2.default)(value);
							return ("%" === height.type || "px" === height.type) && height.value > 0;
						}
						return value >= 0;
					}
				},
				pivotX: {
					type: Number,
					default: .5,
					validator: function (value) {
						return value >= 0 && value <= 1;
					}
				},
				pivotY: {
					type: Number,
					default: .5,
					validator: function (value) {
						return value >= 0 && value <= 1;
					}
				}
			},
			components: {
				Resizer: _Resizer2.default
			},
			data: function () {
				return {
					visible: !1,
					visibility: {
						modal: !1,
						overlay: !1
					},
					shift: {
						left: 0,
						top: 0
					},
					modal: {
						width: 0,
						widthType: "px",
						height: 0,
						heightType: "px",
						renderedHeight: 0
					},
					window: {
						width: 0,
						height: 0
					},
					mutationObserver: null
				};
			},
			watch: {
				visible: function (value) {
					var _this = this;
					value ? (this.visibility.overlay = !0, setTimeout(function () {
						_this.visibility.modal = !0, _this.$nextTick(function () {
							_this.addDraggableListeners(), _this.callAfterEvent(!0);
						});
					}, this.delay)) : (this.visibility.modal = !1, setTimeout(function () {
						_this.visibility.overlay = !1, _this.$nextTick(function () {
							_this.removeDraggableListeners(), _this.callAfterEvent(!1);
						});
					}, this.delay));
				}
			},
			created: function () {
				this.setInitialSize();
			},
			beforeMount: function () {
				var _this2 = this;
				if (_index2.default.event.$on("toggle", function (name, state, params) {
						name === _this2.name && (void 0 === state && (state = !_this2.visible), _this2.toggle(state, params));
					}), window.addEventListener("resize", this.onWindowResize), this.onWindowResize(), this.scrollable && !this.isAutoHeight && console.warn('Modal "' + this.name + '" has scrollable flag set to true but height is not "auto" (' + this.height + ")"), this.isAutoHeight) {
					var MutationObserver = function () {
						for (var prefixes = ["", "WebKit", "Moz", "O", "Ms"], i = 0; i < prefixes.length; i++) {
							var name = prefixes[i] + "MutationObserver";
							if (name in window) return window[name];
						}
						return !1;
					}();
					MutationObserver && (this.mutationObserver = new MutationObserver(function (mutations) {
						_this2.updateRenderedHeight();
					}));
				}
				this.clickToClose && window.addEventListener("keyup", this.onEscapeKeyUp);
			},
			beforeDestroy: function () {
				window.removeEventListener("resize", this.onWindowResize), this.clickToClose && window.removeEventListener("keyup", this.onEscapeKeyUp);
			},
			computed: {
				isAutoHeight: function () {
					return "auto" === this.modal.heightType;
				},
				position: function () {
					var window = this.window,
						shift = this.shift,
						pivotX = this.pivotX,
						pivotY = this.pivotY,
						trueModalWidth = this.trueModalWidth,
						trueModalHeight = this.trueModalHeight,
						maxLeft = window.width - trueModalWidth,
						maxTop = window.height - trueModalHeight,
						left = shift.left + pivotX * maxLeft,
						top = shift.top + pivotY * maxTop;
					return {
						left: (0, _util.inRange)(0, maxLeft, left),
						top: (0, _util.inRange)(0, maxTop, top)
					};
				},
				trueModalWidth: function () {
					var window = this.window,
						modal = this.modal,
						adaptive = this.adaptive,
						minWidth = this.minWidth,
						maxWidth = this.maxWidth,
						value = "%" === modal.widthType ? window.width / 100 * modal.width : modal.width,
						max = Math.min(window.width, maxWidth);
					return adaptive ? (0, _util.inRange)(minWidth, max, value) : value;
				},
				trueModalHeight: function () {
					var window = this.window,
						modal = this.modal,
						isAutoHeight = this.isAutoHeight,
						adaptive = this.adaptive,
						maxHeight = this.maxHeight,
						value = "%" === modal.heightType ? window.height / 100 * modal.height : modal.height;
					if (isAutoHeight) return this.modal.renderedHeight;
					var max = Math.min(window.height, maxHeight);
					return adaptive ? (0, _util.inRange)(this.minHeight, max, value) : value;
				},
				overlayClass: function () {
					return {
						"v--modal-overlay": !0,
						scrollable: this.scrollable && this.isAutoHeight
					};
				},
				modalClass: function () {
					return ["v--modal-box", this.classes];
				},
				modalStyle: function () {
					return {
						top: this.position.top + "px",
						left: this.position.left + "px",
						width: this.trueModalWidth + "px",
						height: this.isAutoHeight ? "auto" : this.trueModalHeight + "px"
					};
				}
			},
			methods: {
				setInitialSize: function () {
					var modal = this.modal,
						width = (0, _parser2.default)(this.width),
						height = (0, _parser2.default)(this.height);
					modal.width = width.value, modal.widthType = width.type, modal.height = height.value, modal.heightType = height.type;
				},
				onEscapeKeyUp: function (event) {
					27 === event.which && this.visible && this.$modal.hide(this.name);
				},
				onWindowResize: function () {
					this.window.width = window.innerWidth, this.window.height = window.innerHeight;
				},
				genEventObject: function (params) {
					var eventData = {
						name: this.name,
						timestamp: Date.now(),
						canceled: !1,
						ref: this.$refs.modal
					};
					return Object.assign(eventData, params || {});
				},
				onModalResize: function (event) {
					this.modal.widthType = "px", this.modal.width = event.size.width, this.modal.heightType = "px", this.modal.height = event.size.height;
					var size = this.modal.size,
						resizeEvent = this.genEventObject({
							size: size
						});
					this.$emit("resize", resizeEvent);
				},
				toggle: function (state, params) {
					var reset = this.reset,
						scrollable = this.scrollable,
						visible = this.visible;
					if (visible !== state) {
						var beforeEventName = visible ? "before-close" : "before-open";
						"before-open" === beforeEventName ? (document.activeElement && document.activeElement.blur(), reset && (this.setInitialSize(), this.shift.left = 0, this.shift.top = 0), scrollable && document.body.classList.add("v--modal-block-scroll")) : scrollable && document.body.classList.remove("v--modal-block-scroll");
						var stopEventExecution = !1,
							stop = function () {
								stopEventExecution = !0;
							},
							beforeEvent = this.genEventObject({
								stop: stop,
								state: state,
								params: params
							});
						this.$emit(beforeEventName, beforeEvent), stopEventExecution || (this.visible = state);
					}
				},
				getDraggableElement: function () {
					var selector = "string" != typeof this.draggable ? ".v--modal-box" : this.draggable;
					if (selector) {
						var handler = this.$refs.overlay.querySelector(selector);
						if (handler) return handler;
					}
				},
				onBackgroundClick: function () {
					this.clickToClose && this.toggle(!1);
				},
				addDraggableListeners: function () {
					var _this3 = this;
					if (this.draggable) {
						var dragger = this.getDraggableElement();
						if (dragger) {
							var startX = 0,
								startY = 0,
								cachedShiftX = 0,
								cachedShiftY = 0,
								getPosition = function (event) {
									return event.touches && event.touches.length > 0 ? event.touches[0] : event;
								},
								mousedown = function (event) {
									var target = event.target;
									if (!target || "INPUT" !== target.nodeName) {
										var _getPosition = getPosition(event),
											clientX = _getPosition.clientX,
											clientY = _getPosition.clientY;
										document.addEventListener("mousemove", _mousemove), document.addEventListener("mouseup", _mouseup), document.addEventListener("touchmove", _mousemove), document.addEventListener("touchend", _mouseup), startX = clientX, startY = clientY, cachedShiftX = _this3.shift.left, cachedShiftY = _this3.shift.top;
									}
								},
								_mousemove = function (event) {
									var _getPosition2 = getPosition(event),
										clientX = _getPosition2.clientX,
										clientY = _getPosition2.clientY;
									_this3.shift.left = cachedShiftX + clientX - startX, _this3.shift.top = cachedShiftY + clientY - startY, event.preventDefault();
								},
								_mouseup = function _mouseup(event) {
									document.removeEventListener("mousemove", _mousemove), document.removeEventListener("mouseup", _mouseup), document.removeEventListener("touchmove", _mousemove), document.removeEventListener("touchend", _mouseup), event.preventDefault();
								};
							dragger.addEventListener("mousedown", mousedown), dragger.addEventListener("touchstart", mousedown);
						}
					}
				},
				removeDraggableListeners: function () {},
				callAfterEvent: function (state) {
					state ? this.connectObserver() : this.disconnectObserver();
					var eventName = state ? "opened" : "closed",
						event = this.genEventObject({
							state: state
						});
					this.$emit(eventName, event);
				},
				updateRenderedHeight: function () {
					this.$refs.modal && (this.modal.renderedHeight = this.$refs.modal.getBoundingClientRect().height);
				},
				connectObserver: function () {
					this.mutationObserver && this.mutationObserver.observe(this.$refs.modal, {
						childList: !0,
						attributes: !0,
						subtree: !0
					});
				},
				disconnectObserver: function () {
					this.mutationObserver && this.mutationObserver.disconnect();
				}
			}
		};
	}, function (module, exports, __webpack_require__) {
		"use strict";
		Object.defineProperty(exports, "__esModule", {
			value: !0
		}), exports.default = {
			data: function () {
				return {
					uid: 0,
					modals: []
				};
			},
			created: function () {
				this.$modal._setDynamicContainer(this);
			},
			methods: {
				add: function (modal, params, config) {
					var _this = this,
						id = this.uid++;
					config = config ? Object.assign({}, config) : {}, config.name || (config.name = "_dynamic-modal-" + id), this.modals.push({
						id: id,
						component: modal,
						params: params || {},
						config: config
					}), this.$nextTick(function () {
						_this.$modal.show(config.name);
					});
				},
				remove: function (id) {
					for (var i in this.modals)
						if (this.modals[i].id === id) return void this.modals.splice(i, 1);
				}
			}
		};
	}, function (module, exports, __webpack_require__) {
		"use strict";
		Object.defineProperty(exports, "__esModule", {
			value: !0
		});
		var _util = __webpack_require__(4);
		exports.default = {
			name: "VueJsModalResizer",
			props: {
				minHeight: {
					type: Number,
					default: 0
				},
				minWidth: {
					type: Number,
					default: 0
				}
			},
			data: function () {
				return {
					clicked: !1,
					size: {}
				};
			},
			mounted: function () {
				this.$el.addEventListener("mousedown", this.start, !1);
			},
			computed: {
				className: function () {
					return {
						"vue-modal-resizer": !0,
						clicked: this.clicked
					};
				}
			},
			methods: {
				start: function (event) {
					this.clicked = !0, window.addEventListener("mousemove", this.mousemove, !1), window.addEventListener("mouseup", this.stop, !1), event.stopPropagation(), event.preventDefault();
				},
				stop: function () {
					this.clicked = !1, window.removeEventListener("mousemove", this.mousemove, !1), window.removeEventListener("mouseup", this.stop, !1), this.$emit("resize-stop", {
						element: this.$el.parentElement,
						size: this.size
					});
				},
				mousemove: function (event) {
					this.resize(event);
				},
				resize: function (event) {
					var el = this.$el.parentElement;
					if (el) {
						var width = event.clientX - el.offsetLeft,
							height = event.clientY - el.offsetTop;
						width = (0, _util.inRange)(this.minWidth, window.innerWidth, width), height = (0, _util.inRange)(this.minHeight, window.innerHeight, height), this.size = {
							width: width,
							height: height
						}, el.style.width = width + "px", el.style.height = height + "px", this.$emit("resize", {
							element: el,
							size: this.size
						});
					}
				}
			}
		};
	}, function (module, exports, __webpack_require__) {
		"use strict";
		Object.defineProperty(exports, "__esModule", {
			value: !0
		});
		var _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) {
				return typeof obj;
			} : function (obj) {
				return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
			},
			types = [{
				name: "px",
				regexp: new RegExp("^[-+]?[0-9]*.?[0-9]+px$")
			}, {
				name: "%",
				regexp: new RegExp("^[-+]?[0-9]*.?[0-9]+%$")
			}, {
				name: "px",
				regexp: new RegExp("^[-+]?[0-9]*.?[0-9]+$")
			}],
			getType = function (value) {
				if ("auto" === value) return {
					type: value,
					value: 0
				};
				for (var i = 0; i < types.length; i++) {
					var type = types[i];
					if (type.regexp.test(value)) return {
						type: type.name,
						value: parseFloat(value)
					};
				}
				return {
					type: "",
					value: value
				};
			},
			parse = exports.parse = function (value) {
				switch (void 0 === value ? "undefined" : _typeof(value)) {
					case "number":
						return {
							type: "px",
							value: value
						};
					case "string":
						return getType(value);
					default:
						return {
							type: "",
							value: value
						};
				}
			};
		exports.default = parse;
	}, function (module, exports, __webpack_require__) {
		exports = module.exports = __webpack_require__(1)(), exports.push([module.i, "\n.vue-dialog div {\r\n  box-sizing: border-box;\n}\n.vue-dialog .dialog-flex {\r\n  width: 100%;\r\n  height: 100%;\n}\n.vue-dialog .dialog-content {\r\n  flex: 1 0 auto;\r\n  width: 100%;\r\n  padding: 15px;\r\n  font-size: 14px;\n}\n.vue-dialog .dialog-c-title {\r\n  font-weight: 600;\r\n  padding-bottom: 15px;\n}\n.vue-dialog .dialog-c-text {\n}\n.vue-dialog .vue-dialog-buttons {\r\n  display: flex;\r\n  flex: 0 1 auto;\r\n  width: 100%;\r\n  border-top: 1px solid #eee;\n}\n.vue-dialog .vue-dialog-buttons-none {\r\n  width: 100%;\r\n  padding-bottom: 15px;\n}\n.vue-dialog-button {\r\n  font-size: 12px !important;\r\n  background: transparent;\r\n  padding: 0;\r\n  margin: 0;\r\n  border: 0;\r\n  cursor: pointer;\r\n  box-sizing: border-box;\r\n  line-height: 40px;\r\n  height: 40px;\r\n  color: inherit;\r\n  font: inherit;\r\n  outline: none;\n}\n.vue-dialog-button:hover {\r\n  background: rgba(0, 0, 0, 0.01);\n}\n.vue-dialog-button:active {\r\n  background: rgba(0, 0, 0, 0.025);\n}\n.vue-dialog-button:not(:first-of-type) {\r\n  border-left: 1px solid #eee;\n}\r\n", ""]);
	}, function (module, exports, __webpack_require__) {
		exports = module.exports = __webpack_require__(1)(), exports.push([module.i, "\n.v--modal-block-scroll {\r\n  position: absolute;\r\n  overflow: hidden;\r\n  width: 100vw;\n}\n.v--modal-overlay {\r\n  position: fixed;\r\n  box-sizing: border-box;\r\n  left: 0;\r\n  top: 0;\r\n  width: 100%;\r\n  height: 100vh;\r\n  background: rgba(0, 0, 0, 0.2);\r\n  z-index: 999;\r\n  opacity: 1;\n}\n.v--modal-overlay.scrollable {\r\n  height: 100%;\r\n  min-height: 100vh;\r\n  overflow-y: auto;\r\n  padding-bottom: 10px;\r\n  -webkit-overflow-scrolling: touch;\n}\n.v--modal-overlay .v--modal-box {\r\n  position: relative;\r\n  overflow: hidden;\r\n  box-sizing: border-box;\n}\n.v--modal-overlay.scrollable .v--modal-box {\r\n  margin-bottom: 2px;\r\n  /* transition: top 0.2s ease; */\n}\n.v--modal {\r\n  background-color: white;\r\n  text-align: left;\r\n  border-radius: 3px;\r\n  box-shadow: 0 20px 60px -2px rgba(27, 33, 58, 0.4);\r\n  padding: 0;\n}\n.v--modal.v--modal-fullscreen {\r\n  width: 100vw;\r\n  height: 100vh;\r\n  margin: 0;\r\n  left: 0;\r\n  top: 0;\n}\n.v--modal-top-right {\r\n  display: block;\r\n  position: absolute;\r\n  right: 0;\r\n  top: 0;\n}\n.overlay-fade-enter-active,\r\n.overlay-fade-leave-active {\r\n  transition: all 0.2s;\n}\n.overlay-fade-enter,\r\n.overlay-fade-leave-active {\r\n  opacity: 0;\n}\n.nice-modal-fade-enter-active,\r\n.nice-modal-fade-leave-active {\r\n  transition: all 0.4s;\n}\n.nice-modal-fade-enter,\r\n.nice-modal-fade-leave-active {\r\n  opacity: 0;\r\n  transform: translateY(-20px);\n}\r\n", ""]);
	}, function (module, exports, __webpack_require__) {
		exports = module.exports = __webpack_require__(1)(), exports.push([module.i, "\n.vue-modal-resizer {\r\n  display: block;\r\n  overflow: hidden;\r\n  position: absolute;\r\n  width: 12px;\r\n  height: 12px;\r\n  right: 0;\r\n  bottom: 0;\r\n  z-index: 9999999;\r\n  background: transparent;\r\n  cursor: se-resize;\n}\n.vue-modal-resizer::after {\r\n  display: block;\r\n  position: absolute;\r\n  content: '';\r\n  background: transparent;\r\n  left: 0;\r\n  top: 0;\r\n  width: 0;\r\n  height: 0;\r\n  border-bottom: 10px solid #ddd;\r\n  border-left: 10px solid transparent;\n}\n.vue-modal-resizer.clicked::after {\r\n  border-bottom: 10px solid #369be9;\n}\r\n", ""]);
	}, function (module, exports, __webpack_require__) {
		__webpack_require__(23);
		var Component = __webpack_require__(0)(__webpack_require__(11), __webpack_require__(20), null, null);
		Component.options.__file = "D:\\Projects\\vue\\vue-js-modal\\src\\Resizer.vue", Component.esModule && Object.keys(Component.esModule).some(function (key) {
			return "default" !== key && "__esModule" !== key;
		}) && console.error("named exports are not supported in *.vue files."), Component.options.functional && console.error("[vue-loader] Resizer.vue: functional components are not supported with templates, they should use render functions."), module.exports = Component.exports;
	}, function (module, exports, __webpack_require__) {
		module.exports = {
			render: function () {
				var _vm = this,
					_h = _vm.$createElement,
					_c = _vm._self._c || _h;
				return _c("div", {
					attrs: {
						id: "#modals-container"
					}
				}, _vm._l(_vm.modals, function (modal) {
					return _c("modal", _vm._b({
						key: modal.id,
						on: {
							closed: function ($event) {
								_vm.remove(modal.id);
							}
						}
					}, "modal", modal.config, !1), [_c(modal.component, _vm._b({
						tag: "component",
						on: {
							close: function ($event) {
								_vm.$modal.hide(modal.config.name);
							}
						}
					}, "component", modal.params, !1))], 1);
				}));
			},
			staticRenderFns: []
		}, module.exports.render._withStripped = !0;
	}, function (module, exports, __webpack_require__) {
		module.exports = {
			render: function () {
				var _vm = this,
					_h = _vm.$createElement,
					_c = _vm._self._c || _h;
				return _c("modal", {
					attrs: {
						name: "dialog",
						height: "auto",
						classes: ["v--modal", "vue-dialog", this.params.class],
						width: _vm.width,
						"pivot-y": .3,
						adaptive: !0,
						clickToClose: _vm.clickToClose,
						transition: _vm.transition
					},
					on: {
						"before-open": _vm.beforeOpened,
						"before-close": _vm.beforeClosed,
						opened: function ($event) {
							_vm.$emit("opened", $event);
						},
						closed: function ($event) {
							_vm.$emit("closed", $event);
						}
					}
				}, [_c("div", {
					staticClass: "dialog-content"
				}, [_vm.params.title ? _c("div", {
					staticClass: "dialog-c-title",
					domProps: {
						innerHTML: _vm._s(_vm.params.title || "")
					}
				}) : _vm._e(), _vm._v(" "), _c("div", {
					staticClass: "dialog-c-text",
					domProps: {
						innerHTML: _vm._s(_vm.params.text || "")
					}
				})]), _vm._v(" "), _vm.buttons ? _c("div", {
					staticClass: "vue-dialog-buttons"
				}, _vm._l(_vm.buttons, function (button, i) {
					return _c("button", {
						key: i,
						class: button.class || "vue-dialog-button",
						style: _vm.buttonStyle,
						attrs: {
							type: "button"
						},
						domProps: {
							innerHTML: _vm._s(button.title)
						},
						on: {
							click: function ($event) {
								$event.stopPropagation(), _vm.click(i, $event);
							}
						}
					}, [_vm._v("\n      " + _vm._s(button.title) + "\n    ")]);
				})) : _c("div", {
					staticClass: "vue-dialog-buttons-none"
				})]);
			},
			staticRenderFns: []
		}, module.exports.render._withStripped = !0;
	}, function (module, exports, __webpack_require__) {
		module.exports = {
			render: function () {
				var _vm = this,
					_h = _vm.$createElement,
					_c = _vm._self._c || _h;
				return _c("transition", {
					attrs: {
						name: "overlay-fade"
					}
				}, [_vm.visibility.overlay ? _c("div", {
					ref: "overlay",
					class: _vm.overlayClass,
					attrs: {
						"aria-expanded": _vm.visible.toString(),
						"data-modal": _vm.name
					},
					on: {
						mousedown: function ($event) {
							$event.stopPropagation(), _vm.onBackgroundClick($event);
						},
						touchstart: function ($event) {
							$event.stopPropagation(), _vm.onBackgroundClick($event);
						}
					}
				}, [_c("div", {
					staticClass: "v--modal-top-right"
				}, [_vm._t("top-right")], 2), _vm._v(" "), _c("transition", {
					attrs: {
						name: _vm.transition
					}
				}, [_vm.visibility.modal ? _c("div", {
					ref: "modal",
					class: _vm.modalClass,
					style: _vm.modalStyle,
					on: {
						mousedown: function ($event) {
							$event.stopPropagation();
						},
						touchstart: function ($event) {
							$event.stopPropagation();
						}
					}
				}, [_vm._t("default"), _vm._v(" "), _vm.resizable && !_vm.isAutoHeight ? _c("resizer", {
					attrs: {
						"min-width": _vm.minWidth,
						"min-height": _vm.minHeight
					},
					on: {
						resize: _vm.onModalResize
					}
				}) : _vm._e()], 2) : _vm._e()])], 1) : _vm._e()]);
			},
			staticRenderFns: []
		}, module.exports.render._withStripped = !0;
	}, function (module, exports, __webpack_require__) {
		module.exports = {
			render: function () {
				var _vm = this,
					_h = _vm.$createElement;
				return (_vm._self._c || _h)("div", {
					class: _vm.className
				});
			},
			staticRenderFns: []
		}, module.exports.render._withStripped = !0;
	}, function (module, exports, __webpack_require__) {
		var content = __webpack_require__(13);
		"string" == typeof content && (content = [
			[module.i, content, ""]
		]), content.locals && (module.exports = content.locals);
		__webpack_require__(2)("237a7ca4", content, !1);
	}, function (module, exports, __webpack_require__) {
		var content = __webpack_require__(14);
		"string" == typeof content && (content = [
			[module.i, content, ""]
		]), content.locals && (module.exports = content.locals);
		__webpack_require__(2)("2790b368", content, !1);
	}, function (module, exports, __webpack_require__) {
		var content = __webpack_require__(15);
		"string" == typeof content && (content = [
			[module.i, content, ""]
		]), content.locals && (module.exports = content.locals);
		__webpack_require__(2)("02ec91af", content, !1);
	}, function (module, exports) {
		module.exports = function (parentId, list) {
			for (var styles = [], newStyles = {}, i = 0; i < list.length; i++) {
				var item = list[i],
					id = item[0],
					css = item[1],
					media = item[2],
					sourceMap = item[3],
					part = {
						id: parentId + ":" + i,
						css: css,
						media: media,
						sourceMap: sourceMap
					};
				newStyles[id] ? newStyles[id].parts.push(part) : styles.push(newStyles[id] = {
					id: id,
					parts: [part]
				});
			}
			return styles;
		};
	}]);
});;
! function (e, t) {
	"object" == typeof exports && "undefined" != typeof module ? t(exports) : "function" == typeof define && define.amd ? define(["exports"], t) : t(e.vueYandexMaps = {})
}(this, function (e) {
	"use strict";
	var t = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (e) {
			return typeof e
		} : function (e) {
			return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
		},
		r = function (e, t) {
			if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function")
		},
		o = function () {
			function e(e, t) {
				for (var r = 0; r < t.length; r++) {
					var o = t[r];
					o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, o.key, o)
				}
			}
			return function (t, r, o) {
				return r && e(t.prototype, r), o && e(t, o), t
			}
		}(),
		n = function (e) {
			if (Array.isArray(e)) {
				for (var t = 0, r = Array(e.length); t < e.length; t++) r[t] = e[t];
				return r
			}
			return Array.from(e)
		};

	function a(e) {
		return e.charAt(0).toUpperCase() + e.slice(1)
	}

	function i(e, r) {
		var o = [];
		return function e(r, n) {
			if (r === n) return !0;
			if (r instanceof Date && n instanceof Date) return +r == +n;
			if ("object" !== (void 0 === r ? "undefined" : t(r)) || "object" !== (void 0 === n ? "undefined" : t(n))) return !1;
			if (function (e, t) {
					for (var r = o.length; r--;)
						if (!(o[r][0] !== e && o[r][0] !== t || o[r][1] !== t && o[r][1] !== e)) return !0;
					return !1
				}(r, n)) return !0;
			o.push([r, n]);
			var a = Object.keys(r),
				i = a.length;
			if (Object.keys(n).length !== i) return !1;
			for (; i--;)
				if (!e(r[a[i]], n[a[i]])) return !1;
			return !0
		}(e, r)
	}
	var s = new(function () {
			function e() {
				r(this, e), this.events = {}, this.ymapReady = !1, this.scriptIsNotAttached = !0
			}
			return o(e, [{
				key: "$on",
				value: function (e, t) {
					var r = this;
					return this.events[e] || (this.events[e] = []), this.events[e].push(t),
						function () {
							r.events[e] = r.events[e].filter(function (e) {
								return t !== e
							})
						}
				}
			}, {
				key: "$emit",
				value: function (e, t) {
					var r = this.events[e];
					r && r.forEach(function (e) {
						return e(t)
					})
				}
			}]), e
		}()),
		c = ["fullscreenControl", "geolocationControl", "routeEditor", "rulerControl", "searchControl", "trafficControl", "typeSelector", "zoomControl"];

	function l(e) {
		return 0 === e.filter(function (e) {
			return ![].concat(c, ["default"]).includes(e)
		}).length
	}

	function u(e, t) {
		var r = a(e);
		if (!t) return r;
		switch (r) {
			case "Placemark":
				return "Point";
			case "Polyline":
				return "LineString";
			default:
				return r
		}
	}

	function p(e, r) {
		var o = r ? {
			type: "Feature",
			id: e.properties.markerId,
			geometry: {
				type: e.markerType,
				coordinates: e.coords
			},
			properties: e.properties,
			options: e.options
		} : new ymaps[e.markerType](e.coords, e.properties, e.options);
		return o.clusterName = e.clusterName, r || function (e, r) {
			if (e && "object" === (void 0 === e ? "undefined" : t(e)))
				for (var o in e) r.events.add(o, e[o])
		}(e.callbacks, o), o
	}
	var m = {
			data: function () {
				return {
					ymapEventBus: s,
					ymapId: "yandexMap" + Math.round(1e5 * Math.random()),
					myMap: {},
					style: this.ymapClass ? "" : "width: 100%; height: 100%;"
				}
			},
			props: {
				coords: {
					type: Array,
					validator: function (e) {
						return !e.filter(function (e) {
							return isNaN(e)
						}).length
					},
					required: !0
				},
				zoom: {
					validator: function (e) {
						return !isNaN(e)
					},
					default: 18
				},
				clusterOptions: {
					type: Object,
					default: function () {
						return {}
					}
				},
				clusterCallbacks: {
					type: Object,
					default: function () {
						return {}
					}
				},
				behaviors: {
					type: Array,
					default: function () {
						return ["default"]
					}
				},
				controls: {
					type: Array,
					default: function () {
						return ["default"]
					},
					validator: function (e) {
						return l(e)
					}
				},
				detailedControls: {
					type: Object,
					validator: function (e) {
						return l(Object.keys(e))
					}
				},
				scrollZoom: {
					type: Boolean,
					default: !0
				},
				zoomControl: Object,
				mapType: {
					type: String,
					default: "map",
					validator: function (e) {
						return ["map", "satellite", "hybrid"].includes(e)
					}
				},
				placemarks: {
					type: Array,
					default: function () {
						return []
					}
				},
				useObjectManager: {
					type: Boolean,
					default: !1
				},
				objectManagerClusterize: {
					type: Boolean,
					default: !0
				},
				ymapClass: String,
				initWithoutMarkers: {
					type: Boolean,
					default: !0
				}
			},
			computed: {
				coordinates: function () {
					return this.coords.map(function (e) {
						return +e
					})
				}
			},
			methods: {
				init: function () {
					var e = this;
					if (window.ymaps && ymaps.GeoObjectCollection && (this.initWithoutMarkers || this.$slots.default || this.placemarks.length)) {
						this.$emit("map-initialization-started");
						for (var t = [], r = this.$slots.default && this.$slots.default.map(function (e) {
								var t = e.componentOptions && e.componentOptions.propsData;
								if (t) {
									var r = {};
									if (t.balloonTemplate) {
										r = {
											balloonContentLayout: ymaps.templateLayoutFactory.createClass(t.balloonTemplate)
										}
									}
									var o = {
										markerId: t.markerId,
										markerType: t.markerType,
										coords: function e(t) {
											return t.map(function (t) {
												return Array.isArray(t) ? e(t) : +t
											})
										}(t.coords),
										hintContent: t.hintContent,
										markerFill: t.markerFill,
										circleRadius: +t.circleRadius,
										clusterName: t.clusterName,
										markerStroke: t.markerStroke,
										balloon: t.balloon,
										callbacks: t.callbacks,
										properties: t.properties,
										options: t.options,
										balloonOptions: r
									};
									return t.icon && "default#image" === t.icon.layout ? (o.iconLayout = t.icon.layout, o.iconImageHref = t.icon.imageHref, o.iconImageSize = t.icon.imageSize, o.iconImageOffset = t.icon.imageOffset) : o.icon = t.icon, o
								}
							}).filter(function (e) {
								return e && e.markerType
							}) || [], o = 0; o < r.length; o++) {
							var i = r[o],
								s = u(i.markerType, this.useObjectManager),
								c = {
									hintContent: i.hintContent,
									iconContent: i.icon && i.icon.content,
									markerId: i.markerId
								},
								l = i.balloon ? {
									balloonContentHeader: i.balloon.header,
									balloonContentBody: i.balloon.body,
									balloonContentFooter: i.balloon.footer
								} : {},
								m = Object.assign(c, l, i.properties),
								d = i.iconLayout ? {
									iconLayout: i.iconLayout,
									iconImageHref: i.iconImageHref,
									iconImageSize: i.iconImageSize,
									iconImageOffset: i.iconImageOffset
								} : {
									preset: i.icon && "islands#" + (v = i, (v.icon.color || "blue") + (v.icon.glyph ? a(v.icon.glyph) : v.icon.content ? "Stretchy" : "")) + "Icon"
								},
								f = i.markerStroke ? {
									strokeColor: i.markerStroke.color || "0066ffff",
									strokeOpacity: parseFloat(i.markerStroke.opacity) >= 0 ? parseFloat(i.markerStroke.opacity) : 1,
									strokeStyle: i.markerStroke.style,
									strokeWidth: parseFloat(i.markerStroke.width) >= 0 ? parseFloat(i.markerStroke.width) : 1
								} : {},
								y = i.markerFill ? {
									fill: i.markerFill.enabled || !0,
									fillColor: i.markerFill.color || "0066ff99",
									fillOpacity: parseFloat(i.markerFill.opacity) >= 0 ? parseFloat(i.markerFill.opacity) : 1,
									fillImageHref: i.markerFill.imageHref || ""
								} : {},
								h = Object.assign(d, f, y, i.balloonOptions, i.options);
							"Circle" === s && (i.coords = [i.coords, i.circleRadius]);
							var b = p({
								properties: m,
								options: h,
								markerType: s,
								coords: i.coords,
								clusterName: i.clusterName,
								callbacks: i.callbacks
							}, this.useObjectManager);
							t.push(b)
						}
						var v;
						if (this.placemarks) {
							var k = this.useObjectManager ? "Point" : "Placemark";
							this.placemarks.forEach(function (r) {
								var o = r.properties,
									n = r.options,
									a = void 0 === n ? {} : n,
									i = r.coords,
									s = r.clusterName,
									c = r.callbacks,
									l = r.balloonTemplate;
								if (l) {
									var u = ymaps.templateLayoutFactory.createClass(l);
									a.balloonContentLayout = u
								}
								var m = p({
									properties: o,
									options: a,
									markerType: k,
									coords: i,
									clusterName: s,
									callbacks: c
								}, e.useObjectManager);
								t.push(m)
							})
						}
						if (this.myMap = new ymaps.Map(this.ymapId, {
								center: this.coordinates,
								zoom: +this.zoom,
								behaviors: this.behaviors,
								controls: this.controls,
								type: "yandex#" + this.mapType
							}), this.zoomControl && (this.myMap.controls.remove("zoomControl"), this.myMap.controls.add(new ymaps.control.ZoomControl(this.zoomControl))), this.detailedControls) {
							Object.keys(this.detailedControls).forEach(function (t) {
								e.myMap.controls.remove(t), e.myMap.controls.add(t, e.detailedControls[t])
							})
						}!1 === this.scrollZoom && this.myMap.behaviors.disable("scrollZoom");
						var g = {
							options: this.clusterOptions,
							callbacks: this.clusterCallbacks,
							map: this.myMap,
							useObjectManager: this.useObjectManager,
							objectManagerClusterize: this.objectManagerClusterize
						};
						! function (e, t) {
							var r = t.options,
								o = t.callbacks,
								a = t.map,
								i = t.useObjectManager,
								s = t.objectManagerClusterize,
								c = {},
								l = [],
								u = !0,
								p = !1,
								m = void 0;
							try {
								for (var d, f = e[Symbol.iterator](); !(u = (d = f.next()).done); u = !0) {
									var y = d.value;
									y.clusterName ? c[y.clusterName] = c[y.clusterName] ? [].concat(n(c[y.clusterName]), [y]) : [y] : l.push(y)
								}
							} catch (e) {
								p = !0, m = e
							} finally {
								try {
									!u && f.return && f.return()
								} finally {
									if (p) throw m
								}
							}
							for (var h in c) {
								var b = r[h] || {},
									v = o[h] || {},
									k = b.layout;
								if (b.clusterBalloonItemContentLayout = ymaps.templateLayoutFactory.createClass(k), i) {
									var g = new ymaps.ObjectManager(Object.assign({
										clusterize: s
									}, b));
									for (var C in v) g.clusters.events.add(C, v[C]);
									g.add(c[h]), a.geoObjects.add(g)
								} else {
									var O = new ymaps.Clusterer(b);
									for (var M in v) O.events.add(M, v[M]);
									O.add(c[h]), a.geoObjects.add(O)
								}
							}
							if (l.length) {
								var j = i ? new ymaps.ObjectManager({
									clusterize: !1
								}) : new ymaps.GeoObjectCollection;
								l.forEach(function (e) {
									return j.add(e)
								}), a.geoObjects.add(j)
							}
						}(t, g), this.$emit("map-was-initialized", this.myMap)
					}
				}
			},
			watch: {
				coordinates: function (e) {
					this.myMap.setCenter && this.myMap.setCenter(e, this.zoom)
				},
				placemarks: function () {
					window.ymaps && (this.myMap.destroy && this.myMap.destroy(), this.init())
				}
			},
			render: function (e) {
				return e("section", {
					class: "ymap-container"
				}, [e("div", {
					attrs: {
						id: this.ymapId,
						class: this.ymapClass,
						style: this.style
					}
				}), e("div", {
					attrs: {
						class: "ymap-markers"
					}
				}, [this.$slots.default])])
			},
			mounted: function () {
				var e = this;
				if (this.observer = new MutationObserver(function (e) {
						this.myMap.destroy && this.myMap.destroy(), this.init()
					}.bind(this)), this.observer.observe(document.querySelector(".ymap-markers"), {
						attributes: !0,
						childList: !0,
						characterData: !0,
						subtree: !0
					}), this.ymapEventBus.scriptIsNotAttached) {
					var t = document.createElement("SCRIPT");
					t.setAttribute("src", "https://api-maps.yandex.ru/2.1/?lang=ru_RU&mode=debug"), t.setAttribute("async", ""), t.setAttribute("defer", ""), document.body.appendChild(t), this.ymapEventBus.scriptIsNotAttached = !1, t.onload = function () {
						e.ymapEventBus.ymapReady = !0, e.ymapEventBus.$emit("scriptIsLoaded")
					}
				}
				this.ymapEventBus.ymapReady ? ymaps.ready(this.init) : this.ymapEventBus.$on("scriptIsLoaded", function () {
					e.ymapEventBus.initMap = function () {
						e.myMap.destroy(), e.init()
					}, ymaps.ready(e.init)
				})
			},
			beforeDestroy: function () {
				this.myMap.GeoObjects && this.myMap.GeoObjects.removeAll(), this.observer.disconnect()
			}
		},
		d = {
			data: function () {
				return {
					ymapEventBus: s,
					unwatchArr: []
				}
			},
			props: {
				coords: {
					type: Array,
					required: !0
				},
				hintContent: String,
				icon: Object,
				balloon: Object,
				markerType: {
					type: String,
					required: !0
				},
				markerFill: Object,
				markerStroke: Object,
				clusterName: String,
				circleRadius: {
					validator: function (e) {
						return !isNaN(e)
					},
					default: 1e3
				},
				callbacks: Object,
				balloonTemplate: String,
				markerId: {
					type: [String, Number],
					required: !0
				},
				properties: Object,
				options: Object
			},
			render: function () {},
			mounted: function () {
				var e = this;
				for (var t in this.$props) this.unwatchArr.push(this.$watch(t, function (t, r) {
					return o = t, n = r, a = e.ymapEventBus, void(i(o, n) || (a.rerender && clearTimeout(a.rerender), a.rerender = setTimeout(function () {
						return a.initMap && a.initMap()
					}, 10)));
					var o, n, a
				}))
			},
			beforeDestroy: function () {
				this.unwatchArr.forEach(function (e) {
					return e()
				})
			}
		};
	m.install = function (e) {
		e.component("yandex-map", m), e.component("ymap-marker", d)
	}, "undefined" != typeof window && window.Vue && window.Vue.use(m);
	var f = m,
		y = d;
	e.yandexMap = f, e.ymapMarker = y, e.default = m, Object.defineProperty(e, "__esModule", {
		value: !0
	})
});;
! function (e, t) {
	"object" == typeof exports && "object" == typeof module ? module.exports = t(require("swiper/dist/js/swiper.js")) : "function" == typeof define && define.amd ? define("VueAwesomeSwiper", ["swiper"], t) : "object" == typeof exports ? exports.VueAwesomeSwiper = t(require("swiper/dist/js/swiper.js")) : e.VueAwesomeSwiper = t(e.Swiper)
}(this, function (e) {
	return function (e) {
		function t(i) {
			if (n[i]) return n[i].exports;
			var s = n[i] = {
				i: i,
				l: !1,
				exports: {}
			};
			return e[i].call(s.exports, s, s.exports, t), s.l = !0, s.exports
		}
		var n = {};
		return t.m = e, t.c = n, t.i = function (e) {
			return e
		}, t.d = function (e, n, i) {
			t.o(e, n) || Object.defineProperty(e, n, {
				configurable: !1,
				enumerable: !0,
				get: i
			})
		}, t.n = function (e) {
			var n = e && e.__esModule ? function () {
				return e.default
			} : function () {
				return e
			};
			return t.d(n, "a", n), n
		}, t.o = function (e, t) {
			return Object.prototype.hasOwnProperty.call(e, t)
		}, t.p = "/", t(t.s = 4)
	}([function (t, n) {
		t.exports = e
	}, function (e, t) {
		e.exports = function (e, t, n, i, s, r) {
			var o, a = e = e || {},
				u = typeof e.default;
			"object" !== u && "function" !== u || (o = e, a = e.default);
			var p = "function" == typeof a ? a.options : a;
			t && (p.render = t.render, p.staticRenderFns = t.staticRenderFns, p._compiled = !0), n && (p.functional = !0), s && (p._scopeId = s);
			var l;
			if (r ? (l = function (e) {
					e = e || this.$vnode && this.$vnode.ssrContext || this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext, e || "undefined" == typeof __VUE_SSR_CONTEXT__ || (e = __VUE_SSR_CONTEXT__), i && i.call(this, e), e && e._registeredComponents && e._registeredComponents.add(r)
				}, p._ssrRegister = l) : i && (l = i), l) {
				var c = p.functional,
					d = c ? p.render : p.beforeCreate;
				c ? (p._injectStyles = l, p.render = function (e, t) {
					return l.call(t), d(e, t)
				}) : p.beforeCreate = d ? [].concat(d, l) : [l]
			}
			return {
				esModule: o,
				exports: a,
				options: p
			}
		}
	}, function (e, t, n) {
		"use strict";
		Object.defineProperty(t, "__esModule", {
			value: !0
		});
		var i = n(5),
			s = n.n(i),
			r = n(8),
			o = n(1),
			a = o(s.a, r.a, !1, null, null, null);
		t.default = a.exports
	}, function (e, t, n) {
		"use strict";
		Object.defineProperty(t, "__esModule", {
			value: !0
		});
		var i = n(6),
			s = n.n(i),
			r = n(7),
			o = n(1),
			a = o(s.a, r.a, !1, null, null, null);
		t.default = a.exports
	}, function (e, t, n) {
		"use strict";

		function i(e) {
			return e && e.__esModule ? e : {
				default: e
			}
		}
		Object.defineProperty(t, "__esModule", {
			value: !0
		}), t.install = t.swiperSlide = t.swiper = t.Swiper = void 0;
		var s = n(0),
			r = i(s),
			o = n(2),
			a = i(o),
			u = n(3),
			p = i(u),
			l = window.Swiper || r.default,
			c = p.default,
			d = a.default,
			f = function (e, t) {
				t && (p.default.props.globalOptions.default = function () {
					return t
				}), e.component(p.default.name, p.default), e.component(a.default.name, a.default)
			},
			h = {
				Swiper: l,
				swiper: c,
				swiperSlide: d,
				install: f
			};
		t.default = h, t.Swiper = l, t.swiper = c, t.swiperSlide = d, t.install = f
	}, function (e, t, n) {
		"use strict";
		Object.defineProperty(t, "__esModule", {
			value: !0
		}), t.default = {
			name: "swiper-slide",
			data: function () {
				return {
					slideClass: "swiper-slide"
				}
			},
			ready: function () {
				this.update()
			},
			mounted: function () {
				this.update(), this.$parent && this.$parent.options && this.$parent.options.slideClass && (this.slideClass = this.$parent.options.slideClass)
			},
			updated: function () {
				this.update()
			},
			attached: function () {
				this.update()
			},
			methods: {
				update: function () {
					this.$parent && this.$parent.swiper && this.$parent.update()
				}
			}
		}
	}, function (e, t, n) {
		"use strict";
		Object.defineProperty(t, "__esModule", {
			value: !0
		});
		var i = n(0),
			s = function (e) {
				return e && e.__esModule ? e : {
					default: e
				}
			}(i),
			r = window.Swiper || s.default;
		"function" != typeof Object.assign && Object.defineProperty(Object, "assign", {
			value: function (e, t) {
				if (null == e) throw new TypeError("Cannot convert undefined or null to object");
				for (var n = Object(e), i = 1; i < arguments.length; i++) {
					var s = arguments[i];
					if (null != s)
						for (var r in s) Object.prototype.hasOwnProperty.call(s, r) && (n[r] = s[r])
				}
				return n
			},
			writable: !0,
			configurable: !0
		});
		var o = ["beforeDestroy", "slideChange", "slideChangeTransitionStart", "slideChangeTransitionEnd", "slideNextTransitionStart", "slideNextTransitionEnd", "slidePrevTransitionStart", "slidePrevTransitionEnd", "transitionStart", "transitionEnd", "touchStart", "touchMove", "touchMoveOpposite", "sliderMove", "touchEnd", "click", "tap", "doubleTap", "imagesReady", "progress", "reachBeginning", "reachEnd", "fromEdge", "setTranslate", "setTransition", "resize"];
		t.default = {
			name: "swiper",
			props: {
				options: {
					type: Object,
					default: function () {
						return {}
					}
				},
				globalOptions: {
					type: Object,
					required: !1,
					default: function () {
						return {}
					}
				}
			},
			data: function () {
				return {
					swiper: null,
					classes: {
						wrapperClass: "swiper-wrapper"
					}
				}
			},
			ready: function () {
				this.swiper || this.mountInstance()
			},
			mounted: function () {
				if (!this.swiper) {
					var e = !1;
					for (var t in this.classes) this.classes.hasOwnProperty(t) && this.options[t] && (e = !0, this.classes[t] = this.options[t]);
					e ? this.$nextTick(this.mountInstance) : this.mountInstance()
				}
			},
			activated: function () {
				this.update()
			},
			updated: function () {
				this.update()
			},
			beforeDestroy: function () {
				this.$nextTick(function () {
					this.swiper && (this.swiper.destroy && this.swiper.destroy(), delete this.swiper)
				})
			},
			methods: {
				update: function () {
					this.swiper && (this.swiper.update && this.swiper.update(), this.swiper.navigation && this.swiper.navigation.update(), this.swiper.pagination && this.swiper.pagination.render(), this.swiper.pagination && this.swiper.pagination.update())
				},
				mountInstance: function () {
					var e = Object.assign({}, this.globalOptions, this.options);
					this.swiper = new r(this.$el, e), this.bindEvents(), this.$emit("ready", this.swiper)
				},
				bindEvents: function () {
					var e = this,
						t = this;
					o.forEach(function (n) {
						e.swiper.on(n, function () {
							t.$emit.apply(t, [n].concat(Array.prototype.slice.call(arguments))), t.$emit.apply(t, [n.replace(/([A-Z])/g, "-$1").toLowerCase()].concat(Array.prototype.slice.call(arguments)))
						})
					})
				}
			}
		}
	}, function (e, t, n) {
		"use strict";
		var i = function () {
				var e = this,
					t = e.$createElement,
					n = e._self._c || t;
				return n("div", {
					staticClass: "swiper-container"
				}, [e._t("parallax-bg"), e._v(" "), n("div", {
					class: e.classes.wrapperClass
				}, [e._t("default")], 2), e._v(" "), e._t("pagination"), e._v(" "), e._t("button-prev"), e._v(" "), e._t("button-next"), e._v(" "), e._t("scrollbar")], 2)
			},
			s = [],
			r = {
				render: i,
				staticRenderFns: s
			};
		t.a = r
	}, function (e, t, n) {
		"use strict";
		var i = function () {
				var e = this,
					t = e.$createElement;
				return (e._self._c || t)("div", {
					class: e.slideClass
				}, [e._t("default")], 2)
			},
			s = [],
			r = {
				render: i,
				staticRenderFns: s
			};
		t.a = r
	}])
});;
! function (e, t) {
	"object" == typeof exports && "object" == typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : "object" == typeof exports ? exports.VueInfiniteLoading = t() : e.VueInfiniteLoading = t()
}("undefined" != typeof self ? self : this, function () {
	return function (e) {
		function t(n) {
			if (i[n]) return i[n].exports;
			var a = i[n] = {
				i: n,
				l: !1,
				exports: {}
			};
			return e[n].call(a.exports, a, a.exports, t), a.l = !0, a.exports
		}
		var i = {};
		return t.m = e, t.c = i, t.d = function (e, i, n) {
			t.o(e, i) || Object.defineProperty(e, i, {
				configurable: !1,
				enumerable: !0,
				get: n
			})
		}, t.n = function (e) {
			var i = e && e.__esModule ? function () {
				return e.default
			} : function () {
				return e
			};
			return t.d(i, "a", i), i
		}, t.o = function (e, t) {
			return Object.prototype.hasOwnProperty.call(e, t)
		}, t.p = "/", t(t.s = 3)
	}([function (e, t) {
		function i(e, t) {
			var i = e[1] || "",
				a = e[3];
			if (!a) return i;
			if (t && "function" == typeof btoa) {
				var r = n(a);
				return [i].concat(a.sources.map(function (e) {
					return "/*# sourceURL=" + a.sourceRoot + e + " */"
				})).concat([r]).join("\n")
			}
			return [i].join("\n")
		}

		function n(e) {
			return "/*# sourceMappingURL=data:application/json;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(e)))) + " */"
		}
		e.exports = function (e) {
			var t = [];
			return t.toString = function () {
				return this.map(function (t) {
					var n = i(t, e);
					return t[2] ? "@media " + t[2] + "{" + n + "}" : n
				}).join("")
			}, t.i = function (e, i) {
				"string" == typeof e && (e = [
					[null, e, ""]
				]);
				for (var n = {}, a = 0; a < this.length; a++) {
					var r = this[a][0];
					"number" == typeof r && (n[r] = !0)
				}
				for (a = 0; a < e.length; a++) {
					var o = e[a];
					"number" == typeof o[0] && n[o[0]] || (i && !o[2] ? o[2] = i : i && (o[2] = "(" + o[2] + ") and (" + i + ")"), t.push(o))
				}
			}, t
		}
	}, function (e, t, i) {
		function n(e) {
			for (var t = 0; t < e.length; t++) {
				var i = e[t],
					n = f[i.id];
				if (n) {
					n.refs++;
					for (var a = 0; a < n.parts.length; a++) n.parts[a](i.parts[a]);
					for (; a < i.parts.length; a++) n.parts.push(r(i.parts[a]));
					n.parts.length > i.parts.length && (n.parts.length = i.parts.length)
				} else {
					for (var o = [], a = 0; a < i.parts.length; a++) o.push(r(i.parts[a]));
					f[i.id] = {
						id: i.id,
						refs: 1,
						parts: o
					}
				}
			}
		}

		function a() {
			var e = document.createElement("style");
			return e.type = "text/css", c.appendChild(e), e
		}

		function r(e) {
			var t, i, n = document.querySelector('style[data-vue-ssr-id~="' + e.id + '"]');
			if (n) {
				if (m) return h;
				n.parentNode.removeChild(n)
			}
			if (b) {
				var r = p++;
				n = u || (u = a()), t = o.bind(null, n, r, !1), i = o.bind(null, n, r, !0)
			} else n = a(), t = s.bind(null, n), i = function () {
				n.parentNode.removeChild(n)
			};
			return t(e),
				function (n) {
					if (n) {
						if (n.css === e.css && n.media === e.media && n.sourceMap === e.sourceMap) return;
						t(e = n)
					} else i()
				}
		}

		function o(e, t, i, n) {
			var a = i ? "" : n.css;
			if (e.styleSheet) e.styleSheet.cssText = g(t, a);
			else {
				var r = document.createTextNode(a),
					o = e.childNodes;
				o[t] && e.removeChild(o[t]), o.length ? e.insertBefore(r, o[t]) : e.appendChild(r)
			}
		}

		function s(e, t) {
			var i = t.css,
				n = t.media,
				a = t.sourceMap;
			if (n && e.setAttribute("media", n), a && (i += "\n/*# sourceURL=" + a.sources[0] + " */", i += "\n/*# sourceMappingURL=data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(a)))) + " */"), e.styleSheet) e.styleSheet.cssText = i;
			else {
				for (; e.firstChild;) e.removeChild(e.firstChild);
				e.appendChild(document.createTextNode(i))
			}
		}
		var l = "undefined" != typeof document;
		if ("undefined" != typeof DEBUG && DEBUG && !l) throw new Error("vue-style-loader cannot be used in a non-browser environment. Use { target: 'node' } in your Webpack config to indicate a server-rendering environment.");
		var d = i(7),
			f = {},
			c = l && (document.head || document.getElementsByTagName("head")[0]),
			u = null,
			p = 0,
			m = !1,
			h = function () {},
			b = "undefined" != typeof navigator && /msie [6-9]\b/.test(navigator.userAgent.toLowerCase());
		e.exports = function (e, t, i) {
			m = i;
			var a = d(e, t);
			return n(a),
				function (t) {
					for (var i = [], r = 0; r < a.length; r++) {
						var o = a[r],
							s = f[o.id];
						s.refs--, i.push(s)
					}
					t ? (a = d(e, t), n(a)) : a = [];
					for (var r = 0; r < i.length; r++) {
						var s = i[r];
						if (0 === s.refs) {
							for (var l = 0; l < s.parts.length; l++) s.parts[l]();
							delete f[s.id]
						}
					}
				}
		};
		var g = function () {
			var e = [];
			return function (t, i) {
				return e[t] = i, e.filter(Boolean).join("\n")
			}
		}()
	}, function (e, t) {
		e.exports = function (e, t, i, n, a, r) {
			var o, s = e = e || {},
				l = typeof e.default;
			"object" !== l && "function" !== l || (o = e, s = e.default);
			var d = "function" == typeof s ? s.options : s;
			t && (d.render = t.render, d.staticRenderFns = t.staticRenderFns, d._compiled = !0), i && (d.functional = !0), a && (d._scopeId = a);
			var f;
			if (r ? (f = function (e) {
					e = e || this.$vnode && this.$vnode.ssrContext || this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext, e || "undefined" == typeof __VUE_SSR_CONTEXT__ || (e = __VUE_SSR_CONTEXT__), n && n.call(this, e), e && e._registeredComponents && e._registeredComponents.add(r)
				}, d._ssrRegister = f) : n && (f = n), f) {
				var c = d.functional,
					u = c ? d.render : d.beforeCreate;
				c ? (d._injectStyles = f, d.render = function (e, t) {
					return f.call(t), u(e, t)
				}) : d.beforeCreate = u ? [].concat(u, f) : [f]
			}
			return {
				esModule: o,
				exports: s,
				options: d
			}
		}
	}, function (e, t, i) {
		"use strict";
		Object.defineProperty(t, "__esModule", {
			value: !0
		});
		var n = i(4);
		t.default = n.a, "undefined" != typeof window && window.Vue && window.Vue.component("infinite-loading", n.a)
	}, function (e, t, i) {
		"use strict";

		function n(e) {
			i(5)
		}
		var a = i(8),
			r = i(14),
			o = i(2),
			s = n,
			l = o(a.a, r.a, !1, s, "data-v-fb2c869e", null);
		t.a = l.exports
	}, function (e, t, i) {
		var n = i(6);
		"string" == typeof n && (n = [
			[e.i, n, ""]
		]), n.locals && (e.exports = n.locals);
		i(1)("2249d7a7", n, !0)
	}, function (e, t, i) {
		t = e.exports = i(0)(void 0), t.push([e.i, ".infinite-loading-container[data-v-fb2c869e]{clear:both;text-align:center}.infinite-loading-container[data-v-fb2c869e] [class^=loading-]{display:inline-block;margin:15px 0;width:28px;height:28px;font-size:28px;line-height:28px;border-radius:50%}.infinite-status-prompt[data-v-fb2c869e]{color:#666;font-size:14px;text-align:center;padding:10px 0}", ""])
	}, function (e, t) {
		e.exports = function (e, t) {
			for (var i = [], n = {}, a = 0; a < t.length; a++) {
				var r = t[a],
					o = r[0],
					s = r[1],
					l = r[2],
					d = r[3],
					f = {
						id: e + ":" + a,
						css: s,
						media: l,
						sourceMap: d
					};
				n[o] ? n[o].parts.push(f) : i.push(n[o] = {
					id: o,
					parts: [f]
				})
			}
			return i
		}
	}, function (e, t, i) {
		"use strict";
		var n = i(9),
			a = {
				STATE_CHANGER: ["[Vue-infinite-loading warn]: emit `loaded` and `complete` event through component instance of `$refs` may cause error, so it will be deprecated soon, please use the `$state` argument instead (`$state` just the special `$event` variable):", "\ntemplate:", '<infinite-loading @infinite="infiniteHandler"></infinite-loading>', "\nscript:\n...\ninfiniteHandler($state) {\n  ajax('https://www.example.com/api/news')\n    .then((res) => {\n      if (res.data.length) {\n        $state.loaded();\n      } else {\n        $state.complete();\n      }\n    });\n}\n...", "", "more details: https://github.com/PeachScript/vue-infinite-loading/issues/57#issuecomment-324370549"].join("\n"),
				INFINITE_EVENT: "[Vue-infinite-loading warn]: `:on-infinite` property will be deprecated soon, please use `@infinite` event instead."
			},
			r = {
				INFINITE_LOOP: ["[Vue-infinite-loading error]: executed the callback function more than 10 times for a short time, it looks like searched a wrong scroll wrapper that doest not has fixed height or maximum height, please check it. If you want to force to set a element as scroll wrapper ranther than automatic searching, you can do this:", '\n\x3c!-- add a special attribute for the real scroll wrapper --\x3e\n<div infinite-wrapper>\n  ...\n  \x3c!-- set force-use-infinite-wrapper to true --\x3e\n  <infinite-loading force-use-infinite-wrapper="true"></infinite-loading>\n</div>\n    ', "more details: https://github.com/PeachScript/vue-infinite-loading/issues/55#issuecomment-316934169"].join("\n")
			};
		t.a = {
			name: "InfiniteLoading",
			data: function () {
				return {
					scrollParent: null,
					scrollHandler: null,
					isLoading: !1,
					isComplete: !1,
					isFirstLoad: !0,
					debounceTimer: null,
					debounceDuration: 50,
					infiniteLoopChecked: !1,
					infiniteLoopTimer: null,
					continuousCallTimes: 0
				}
			},
			components: {
				Spinner: n.a
			},
			computed: {
				isNoResults: {
					cache: !1,
					get: function () {
						var e = this.$slots["no-results"],
							t = e && e[0].elm && "" === e[0].elm.textContent;
						return !this.isLoading && this.isComplete && this.isFirstLoad && !t
					}
				},
				isNoMore: {
					cache: !1,
					get: function () {
						var e = this.$slots["no-more"],
							t = e && e[0].elm && "" === e[0].elm.textContent;
						return !this.isLoading && this.isComplete && !this.isFirstLoad && !t
					}
				}
			},
			props: {
				distance: {
					type: Number,
					default: 100
				},
				onInfinite: Function,
				spinner: String,
				direction: {
					type: String,
					default: "bottom"
				},
				forceUseInfiniteWrapper: null
			},
			mounted: function () {
				var e = this;
				this.scrollParent = this.getScrollParent(), this.scrollHandler = function (e) {
					this.isLoading || (clearTimeout(this.debounceTimer), e && e.constructor === Event ? this.debounceTimer = setTimeout(this.attemptLoad, this.debounceDuration) : this.attemptLoad())
				}.bind(this), setTimeout(this.scrollHandler, 1), this.scrollParent.addEventListener("scroll", this.scrollHandler), this.$on("$InfiniteLoading:loaded", function (t) {
					e.isFirstLoad = !1, e.isLoading && e.$nextTick(e.attemptLoad.bind(null, !0)), t && t.target === e || console.warn(a.STATE_CHANGER)
				}), this.$on("$InfiniteLoading:complete", function (t) {
					e.isLoading = !1, e.isComplete = !0, e.$nextTick(function () {
						e.$forceUpdate()
					}), e.scrollParent.removeEventListener("scroll", e.scrollHandler), t && t.target === e || console.warn(a.STATE_CHANGER)
				}), this.$on("$InfiniteLoading:reset", function () {
					e.isLoading = !1, e.isComplete = !1, e.isFirstLoad = !0, e.scrollParent.addEventListener("scroll", e.scrollHandler), setTimeout(e.scrollHandler, 1)
				}), this.onInfinite && console.warn(a.INFINITE_EVENT), this.stateChanger = {
					loaded: function () {
						e.$emit("$InfiniteLoading:loaded", {
							target: e
						})
					},
					complete: function () {
						e.$emit("$InfiniteLoading:complete", {
							target: e
						})
					},
					reset: function () {
						e.$emit("$InfiniteLoading:reset", {
							target: e
						})
					}
				}, this.$watch("forceUseInfiniteWrapper", function () {
					e.scrollParent = e.getScrollParent()
				})
			},
			deactivated: function () {
				this.isLoading = !1, this.scrollParent.removeEventListener("scroll", this.scrollHandler)
			},
			activated: function () {
				this.scrollParent.addEventListener("scroll", this.scrollHandler)
			},
			methods: {
				attemptLoad: function (e) {
					var t = this,
						i = this.getCurrentDistance();
					!this.isComplete && i <= this.distance && this.$el.offsetWidth + this.$el.offsetHeight > 0 ? (this.isLoading = !0, "function" == typeof this.onInfinite ? this.onInfinite.call(null, this.stateChanger) : this.$emit("infinite", this.stateChanger), !e || this.forceUseInfiniteWrapper || this.infiniteLoopChecked || (this.continuousCallTimes += 1, clearTimeout(this.infiniteLoopTimer), this.infiniteLoopTimer = setTimeout(function () {
						t.infiniteLoopChecked = !0
					}, 1e3), this.continuousCallTimes > 10 && (console.error(r.INFINITE_LOOP), this.infiniteLoopChecked = !0))) : this.isLoading = !1
				},
				getCurrentDistance: function () {
					var e = void 0;
					if ("top" === this.direction) e = isNaN(this.scrollParent.scrollTop) ? this.scrollParent.pageYOffset : this.scrollParent.scrollTop;
					else {
						e = this.$el.getBoundingClientRect().top - (this.scrollParent === window ? window.innerHeight : this.scrollParent.getBoundingClientRect().bottom)
					}
					return e
				},
				getScrollParent: function () {
					var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : this.$el,
						t = void 0;
					return "BODY" === e.tagName ? t = window : !this.forceUseInfiniteWrapper && ["scroll", "auto"].indexOf(getComputedStyle(e).overflowY) > -1 ? t = e : (e.hasAttribute("infinite-wrapper") || e.hasAttribute("data-infinite-wrapper")) && (t = e), t || this.getScrollParent(e.parentNode)
				}
			},
			destroyed: function () {
				this.isComplete || this.scrollParent.removeEventListener("scroll", this.scrollHandler)
			}
		}
	}, function (e, t, i) {
		"use strict";

		function n(e) {
			i(10)
		}
		var a = i(12),
			r = i(13),
			o = i(2),
			s = n,
			l = o(a.a, r.a, !1, s, "data-v-6e1fd88f", null);
		t.a = l.exports
	}, function (e, t, i) {
		var n = i(11);
		"string" == typeof n && (n = [
			[e.i, n, ""]
		]), n.locals && (e.exports = n.locals);
		i(1)("29881045", n, !0)
	}, function (e, t, i) {
		t = e.exports = i(0)(void 0), t.push([e.i, '.loading-wave-dots[data-v-6e1fd88f]{position:relative}.loading-wave-dots[data-v-6e1fd88f] .wave-item{position:absolute;top:50%;left:50%;display:inline-block;margin-top:-4px;width:8px;height:8px;border-radius:50%;-webkit-animation:loading-wave-dots-data-v-6e1fd88f linear 2.8s infinite;animation:loading-wave-dots-data-v-6e1fd88f linear 2.8s infinite}.loading-wave-dots[data-v-6e1fd88f] .wave-item:first-child{margin-left:-36px}.loading-wave-dots[data-v-6e1fd88f] .wave-item:nth-child(2){margin-left:-20px;-webkit-animation-delay:.14s;animation-delay:.14s}.loading-wave-dots[data-v-6e1fd88f] .wave-item:nth-child(3){margin-left:-4px;-webkit-animation-delay:.28s;animation-delay:.28s}.loading-wave-dots[data-v-6e1fd88f] .wave-item:nth-child(4){margin-left:12px;-webkit-animation-delay:.42s;animation-delay:.42s}.loading-wave-dots[data-v-6e1fd88f] .wave-item:last-child{margin-left:28px;-webkit-animation-delay:.56s;animation-delay:.56s}@-webkit-keyframes loading-wave-dots-data-v-6e1fd88f{0%{-webkit-transform:translateY(0);transform:translateY(0);background:#bbb}10%{-webkit-transform:translateY(-6px);transform:translateY(-6px);background:#999}20%{-webkit-transform:translateY(0);transform:translateY(0);background:#bbb}to{-webkit-transform:translateY(0);transform:translateY(0);background:#bbb}}@keyframes loading-wave-dots-data-v-6e1fd88f{0%{-webkit-transform:translateY(0);transform:translateY(0);background:#bbb}10%{-webkit-transform:translateY(-6px);transform:translateY(-6px);background:#999}20%{-webkit-transform:translateY(0);transform:translateY(0);background:#bbb}to{-webkit-transform:translateY(0);transform:translateY(0);background:#bbb}}.loading-circles[data-v-6e1fd88f] .circle-item{width:5px;height:5px;-webkit-animation:loading-circles-data-v-6e1fd88f linear .75s infinite;animation:loading-circles-data-v-6e1fd88f linear .75s infinite}.loading-circles[data-v-6e1fd88f] .circle-item:first-child{margin-top:-14.5px;margin-left:-2.5px}.loading-circles[data-v-6e1fd88f] .circle-item:nth-child(2){margin-top:-11.26px;margin-left:6.26px}.loading-circles[data-v-6e1fd88f] .circle-item:nth-child(3){margin-top:-2.5px;margin-left:9.5px}.loading-circles[data-v-6e1fd88f] .circle-item:nth-child(4){margin-top:6.26px;margin-left:6.26px}.loading-circles[data-v-6e1fd88f] .circle-item:nth-child(5){margin-top:9.5px;margin-left:-2.5px}.loading-circles[data-v-6e1fd88f] .circle-item:nth-child(6){margin-top:6.26px;margin-left:-11.26px}.loading-circles[data-v-6e1fd88f] .circle-item:nth-child(7){margin-top:-2.5px;margin-left:-14.5px}.loading-circles[data-v-6e1fd88f] .circle-item:last-child{margin-top:-11.26px;margin-left:-11.26px}@-webkit-keyframes loading-circles-data-v-6e1fd88f{0%{background:#dfdfdf}90%{background:#505050}to{background:#dfdfdf}}@keyframes loading-circles-data-v-6e1fd88f{0%{background:#dfdfdf}90%{background:#505050}to{background:#dfdfdf}}.loading-bubbles[data-v-6e1fd88f] .bubble-item{background:#666;-webkit-animation:loading-bubbles-data-v-6e1fd88f linear .75s infinite;animation:loading-bubbles-data-v-6e1fd88f linear .75s infinite}.loading-bubbles[data-v-6e1fd88f] .bubble-item:first-child{margin-top:-12.5px;margin-left:-.5px}.loading-bubbles[data-v-6e1fd88f] .bubble-item:nth-child(2){margin-top:-9.26px;margin-left:8.26px}.loading-bubbles[data-v-6e1fd88f] .bubble-item:nth-child(3){margin-top:-.5px;margin-left:11.5px}.loading-bubbles[data-v-6e1fd88f] .bubble-item:nth-child(4){margin-top:8.26px;margin-left:8.26px}.loading-bubbles[data-v-6e1fd88f] .bubble-item:nth-child(5){margin-top:11.5px;margin-left:-.5px}.loading-bubbles[data-v-6e1fd88f] .bubble-item:nth-child(6){margin-top:8.26px;margin-left:-9.26px}.loading-bubbles[data-v-6e1fd88f] .bubble-item:nth-child(7){margin-top:-.5px;margin-left:-12.5px}.loading-bubbles[data-v-6e1fd88f] .bubble-item:last-child{margin-top:-9.26px;margin-left:-9.26px}@-webkit-keyframes loading-bubbles-data-v-6e1fd88f{0%{width:1px;height:1px;box-shadow:0 0 0 3px #666}90%{width:1px;height:1px;box-shadow:0 0 0 0 #666}to{width:1px;height:1px;box-shadow:0 0 0 3px #666}}@keyframes loading-bubbles-data-v-6e1fd88f{0%{width:1px;height:1px;box-shadow:0 0 0 3px #666}90%{width:1px;height:1px;box-shadow:0 0 0 0 #666}to{width:1px;height:1px;box-shadow:0 0 0 3px #666}}.loading-default[data-v-6e1fd88f]{position:relative;border:1px solid #999;-webkit-animation:loading-rotating-data-v-6e1fd88f ease 1.5s infinite;animation:loading-rotating-data-v-6e1fd88f ease 1.5s infinite}.loading-default[data-v-6e1fd88f]:before{content:"";position:absolute;display:block;top:0;left:50%;margin-top:-3px;margin-left:-3px;width:6px;height:6px;background-color:#999;border-radius:50%}.loading-spiral[data-v-6e1fd88f]{border:2px solid #777;border-right-color:transparent;-webkit-animation:loading-rotating-data-v-6e1fd88f linear .85s infinite;animation:loading-rotating-data-v-6e1fd88f linear .85s infinite}@-webkit-keyframes loading-rotating-data-v-6e1fd88f{0%{-webkit-transform:rotate(0);transform:rotate(0)}to{-webkit-transform:rotate(1turn);transform:rotate(1turn)}}@keyframes loading-rotating-data-v-6e1fd88f{0%{-webkit-transform:rotate(0);transform:rotate(0)}to{-webkit-transform:rotate(1turn);transform:rotate(1turn)}}.loading-bubbles[data-v-6e1fd88f],.loading-circles[data-v-6e1fd88f]{position:relative}.loading-bubbles[data-v-6e1fd88f] .bubble-item,.loading-circles[data-v-6e1fd88f] .circle-item{position:absolute;top:50%;left:50%;display:inline-block;border-radius:50%}.loading-bubbles[data-v-6e1fd88f] .bubble-item:nth-child(2),.loading-circles[data-v-6e1fd88f] .circle-item:nth-child(2){-webkit-animation-delay:93ms;animation-delay:93ms}.loading-bubbles[data-v-6e1fd88f] .bubble-item:nth-child(3),.loading-circles[data-v-6e1fd88f] .circle-item:nth-child(3){-webkit-animation-delay:.186s;animation-delay:.186s}.loading-bubbles[data-v-6e1fd88f] .bubble-item:nth-child(4),.loading-circles[data-v-6e1fd88f] .circle-item:nth-child(4){-webkit-animation-delay:.279s;animation-delay:.279s}.loading-bubbles[data-v-6e1fd88f] .bubble-item:nth-child(5),.loading-circles[data-v-6e1fd88f] .circle-item:nth-child(5){-webkit-animation-delay:.372s;animation-delay:.372s}.loading-bubbles[data-v-6e1fd88f] .bubble-item:nth-child(6),.loading-circles[data-v-6e1fd88f] .circle-item:nth-child(6){-webkit-animation-delay:.465s;animation-delay:.465s}.loading-bubbles[data-v-6e1fd88f] .bubble-item:nth-child(7),.loading-circles[data-v-6e1fd88f] .circle-item:nth-child(7){-webkit-animation-delay:.558s;animation-delay:.558s}.loading-bubbles[data-v-6e1fd88f] .bubble-item:last-child,.loading-circles[data-v-6e1fd88f] .circle-item:last-child{-webkit-animation-delay:.651s;animation-delay:.651s}', ""])
	}, function (e, t, i) {
		"use strict";
		var n = {
			BUBBLES: {
				render: function (e) {
					return e("span", {
						attrs: {
							class: "loading-bubbles"
						}
					}, Array.apply(Array, Array(8)).map(function () {
						return e("span", {
							attrs: {
								class: "bubble-item"
							}
						})
					}))
				}
			},
			CIRCLES: {
				render: function (e) {
					return e("span", {
						attrs: {
							class: "loading-circles"
						}
					}, Array.apply(Array, Array(8)).map(function () {
						return e("span", {
							attrs: {
								class: "circle-item"
							}
						})
					}))
				}
			},
			DEFAULT: {
				render: function (e) {
					return e("i", {
						attrs: {
							class: "loading-default"
						}
					})
				}
			},
			SPIRAL: {
				render: function (e) {
					return e("i", {
						attrs: {
							class: "loading-spiral"
						}
					})
				}
			},
			WAVEDOTS: {
				render: function (e) {
					return e("span", {
						attrs: {
							class: "loading-wave-dots"
						}
					}, Array.apply(Array, Array(5)).map(function () {
						return e("span", {
							attrs: {
								class: "wave-item"
							}
						})
					}))
				}
			}
		};
		t.a = {
			name: "spinner",
			computed: {
				spinnerView: function () {
					return n[(this.spinner || "").toUpperCase()] || n.DEFAULT
				}
			},
			props: {
				spinner: String
			}
		}
	}, function (e, t, i) {
		"use strict";
		var n = function () {
				var e = this,
					t = e.$createElement;
				return (e._self._c || t)(e.spinnerView, {
					tag: "component"
				})
			},
			a = [],
			r = {
				render: n,
				staticRenderFns: a
			};
		t.a = r
	}, function (e, t, i) {
		"use strict";
		var n = function () {
				var e = this,
					t = e.$createElement,
					i = e._self._c || t;
				return i("div", {
					staticClass: "infinite-loading-container"
				}, [i("div", {
					directives: [{
						name: "show",
						rawName: "v-show",
						value: e.isLoading,
						expression: "isLoading"
					}]
				}, [e._t("spinner", [i("spinner", {
					attrs: {
						spinner: e.spinner
					}
				})])], 2), e._v(" "), i("div", {
					directives: [{
						name: "show",
						rawName: "v-show",
						value: e.isNoResults,
						expression: "isNoResults"
					}],
					staticClass: "infinite-status-prompt"
				}, [e._t("no-results", [e._v("No results :(")])], 2), e._v(" "), i("div", {
					directives: [{
						name: "show",
						rawName: "v-show",
						value: e.isNoMore,
						expression: "isNoMore"
					}],
					staticClass: "infinite-status-prompt"
				}, [e._t("no-more", [e._v("No more data :)")])], 2)])
			},
			a = [],
			r = {
				render: n,
				staticRenderFns: a
			};
		t.a = r
	}])
});;
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() : typeof define === 'function' && define.amd ? define(factory) : (global['vue-scrollto'] = factory());
}(this, (function () {
	'use strict';
	var NEWTON_ITERATIONS = 4;
	var NEWTON_MIN_SLOPE = 0.001;
	var SUBDIVISION_PRECISION = 0.0000001;
	var SUBDIVISION_MAX_ITERATIONS = 10;
	var kSplineTableSize = 11;
	var kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);
	var float32ArraySupported = typeof Float32Array === 'function';

	function A(aA1, aA2) {
		return 1.0 - 3.0 * aA2 + 3.0 * aA1;
	}

	function B(aA1, aA2) {
		return 3.0 * aA2 - 6.0 * aA1;
	}

	function C(aA1) {
		return 3.0 * aA1;
	}

	function calcBezier(aT, aA1, aA2) {
		return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
	}

	function getSlope(aT, aA1, aA2) {
		return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1);
	}

	function binarySubdivide(aX, aA, aB, mX1, mX2) {
		var currentX, currentT, i = 0;
		do {
			currentT = aA + (aB - aA) / 2.0;
			currentX = calcBezier(currentT, mX1, mX2) - aX;
			if (currentX > 0.0) {
				aB = currentT;
			} else {
				aA = currentT;
			}
		} while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
		return currentT;
	}

	function newtonRaphsonIterate(aX, aGuessT, mX1, mX2) {
		for (var i = 0; i < NEWTON_ITERATIONS; ++i) {
			var currentSlope = getSlope(aGuessT, mX1, mX2);
			if (currentSlope === 0.0) {
				return aGuessT;
			}
			var currentX = calcBezier(aGuessT, mX1, mX2) - aX;
			aGuessT -= currentX / currentSlope;
		}
		return aGuessT;
	}
	var src = function bezier(mX1, mY1, mX2, mY2) {
		if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) {
			throw new Error('bezier x values must be in [0, 1] range');
		}
		var sampleValues = float32ArraySupported ? new Float32Array(kSplineTableSize) : new Array(kSplineTableSize);
		if (mX1 !== mY1 || mX2 !== mY2) {
			for (var i = 0; i < kSplineTableSize; ++i) {
				sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
			}
		}

		function getTForX(aX) {
			var intervalStart = 0.0;
			var currentSample = 1;
			var lastSample = kSplineTableSize - 1;
			for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
				intervalStart += kSampleStepSize;
			}
			--currentSample;
			var dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
			var guessForT = intervalStart + dist * kSampleStepSize;
			var initialSlope = getSlope(guessForT, mX1, mX2);
			if (initialSlope >= NEWTON_MIN_SLOPE) {
				return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
			} else if (initialSlope === 0.0) {
				return guessForT;
			} else {
				return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
			}
		}
		return function BezierEasing(x) {
			if (mX1 === mY1 && mX2 === mY2) {
				return x;
			}
			if (x === 0) {
				return 0;
			}
			if (x === 1) {
				return 1;
			}
			return calcBezier(getTForX(x), mY1, mY2);
		};
	};
	var easings = {
		ease: [0.25, 0.1, 0.25, 1.0],
		linear: [0.00, 0.0, 1.00, 1.0],
		"ease-in": [0.42, 0.0, 1.00, 1.0],
		"ease-out": [0.00, 0.0, 0.58, 1.0],
		"ease-in-out": [0.42, 0.0, 0.58, 1.0]
	};
	var supportsPassive = false;
	try {
		var opts = Object.defineProperty({}, "passive", {
			get: function get() {
				supportsPassive = true;
			}
		});
		window.addEventListener("test", null, opts);
	} catch (e) {}
	var _ = {
		$: function $(selector) {
			if (typeof selector !== "string") {
				return selector;
			}
			return document.querySelector(selector);
		},
		on: function on(element, events, handler) {
			var opts = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {
				passive: false
			};
			if (!(events instanceof Array)) {
				events = [events];
			}
			for (var i = 0; i < events.length; i++) {
				element.addEventListener(events[i], handler, supportsPassive ? opts : false);
			}
		},
		off: function off(element, events, handler) {
			if (!(events instanceof Array)) {
				events = [events];
			}
			for (var i = 0; i < events.length; i++) {
				element.removeEventListener(events[i], handler);
			}
		},
		cumulativeOffset: function cumulativeOffset(element) {
			var top = 0;
			var left = 0;
			do {
				top += element.offsetTop || 0;
				left += element.offsetLeft || 0;
				element = element.offsetParent;
			} while (element);
			return {
				top: top,
				left: left
			};
		}
	};
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
		return typeof obj;
	} : function (obj) {
		return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	};
	var _extends = Object.assign || function (target) {
		for (var i = 1; i < arguments.length; i++) {
			var source = arguments[i];
			for (var key in source) {
				if (Object.prototype.hasOwnProperty.call(source, key)) {
					target[key] = source[key];
				}
			}
		}
		return target;
	};
	var abortEvents = ["mousedown", "wheel", "DOMMouseScroll", "mousewheel", "keyup", "touchmove"];
	var defaults$$1 = {
		container: "body",
		duration: 500,
		easing: "ease",
		offset: 0,
		cancelable: true,
		onStart: false,
		onDone: false,
		onCancel: false,
		x: false,
		y: true
	};

	function setDefaults(options) {
		defaults$$1 = _extends({}, defaults$$1, options);
	}
	var scroller = function scroller() {
		var element = void 0;
		var container = void 0;
		var duration = void 0;
		var easing = void 0;
		var offset = void 0;
		var cancelable = void 0;
		var onStart = void 0;
		var onDone = void 0;
		var onCancel = void 0;
		var x = void 0;
		var y = void 0;
		var initialX = void 0;
		var targetX = void 0;
		var initialY = void 0;
		var targetY = void 0;
		var diffX = void 0;
		var diffY = void 0;
		var abort = void 0;
		var abortEv = void 0;
		var abortFn = function abortFn(e) {
			if (!cancelable) return;
			abortEv = e;
			abort = true;
		};
		var easingFn = void 0;
		var timeStart = void 0;
		var timeElapsed = void 0;
		var progress = void 0;

		function scrollTop(container) {
			var scrollTop = container.scrollTop;
			if (container.tagName.toLowerCase() === "body") {
				scrollTop = scrollTop || document.documentElement.scrollTop;
			}
			return scrollTop;
		}

		function scrollLeft(container) {
			var scrollLeft = container.scrollLeft;
			if (container.tagName.toLowerCase() === "body") {
				scrollLeft = scrollLeft || document.documentElement.scrollLeft;
			}
			return scrollLeft;
		}

		function step(timestamp) {
			if (abort) return done();
			if (!timeStart) timeStart = timestamp;
			timeElapsed = timestamp - timeStart;
			progress = Math.min(timeElapsed / duration, 1);
			progress = easingFn(progress);
			topLeft(container, initialY + diffY * progress, initialX + diffX * progress);
			timeElapsed < duration ? window.requestAnimationFrame(step) : done();
		}

		function done() {
			if (!abort) topLeft(container, targetY, targetX);
			timeStart = false;
			_.off(container, abortEvents, abortFn);
			if (abort && onCancel) onCancel(abortEv, element);
			if (!abort && onDone) onDone(element);
		}

		function topLeft(element, top, left) {
			if (y) element.scrollTop = top;
			if (x) element.scrollLeft = left;
			if (element.tagName.toLowerCase() === "body") {
				if (y) document.documentElement.scrollTop = top;
				if (x) document.documentElement.scrollLeft = left;
			}
		}

		function scrollTo(target, _duration) {
			var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
			if ((typeof _duration === "undefined" ? "undefined" : _typeof(_duration)) === "object") {
				options = _duration;
			} else if (typeof _duration === "number") {
				options.duration = _duration;
			}
			element = _.$(target);
			if (!element) {
				return console.warn("[vue-scrollto warn]: Trying to scroll to an element that is not on the page: " + target);
			}
			container = _.$(options.container || defaults$$1.container);
			duration = options.duration || defaults$$1.duration;
			easing = options.easing || defaults$$1.easing;
			offset = options.offset || defaults$$1.offset;
			cancelable = options.hasOwnProperty("cancelable") ? options.cancelable !== false : defaults$$1.cancelable;
			onStart = options.onStart || defaults$$1.onStart;
			onDone = options.onDone || defaults$$1.onDone;
			onCancel = options.onCancel || defaults$$1.onCancel;
			x = options.x === undefined ? defaults$$1.x : options.x;
			y = options.y === undefined ? defaults$$1.y : options.y;
			var cumulativeOffsetContainer = _.cumulativeOffset(container);
			var cumulativeOffsetElement = _.cumulativeOffset(element);
			if (typeof offset === "function") {
				offset = offset();
			}
			initialY = scrollTop(container);
			targetY = cumulativeOffsetElement.top - cumulativeOffsetContainer.top + offset;
			initialX = scrollLeft(container);
			targetX = cumulativeOffsetElement.left - cumulativeOffsetContainer.left + offset;
			abort = false;
			diffY = targetY - initialY;
			diffX = targetX - initialX;
			if (typeof easing === "string") {
				easing = easings[easing] || easings["ease"];
			}
			easingFn = src.apply(src, easing);
			if (!diffY && !diffX) return;
			if (onStart) onStart(element);
			_.on(container, abortEvents, abortFn, {
				passive: true
			});
			window.requestAnimationFrame(step);
			return function () {
				abortEv = null;
				abort = true;
			};
		}
		return scrollTo;
	};
	var _scroller = scroller();
	var bindings = [];

	function deleteBinding(el) {
		for (var i = 0; i < bindings.length; ++i) {
			if (bindings[i].el === el) {
				bindings.splice(i, 1);
				return true;
			}
		}
		return false;
	}

	function findBinding(el) {
		for (var i = 0; i < bindings.length; ++i) {
			if (bindings[i].el === el) {
				return bindings[i];
			}
		}
	}

	function getBinding(el) {
		var binding = findBinding(el);
		if (binding) {
			return binding;
		}
		bindings.push(binding = {
			el: el,
			binding: {}
		});
		return binding;
	}

	function handleClick(e) {
		e.preventDefault();
		var ctx = getBinding(this).binding;
		if (typeof ctx.value === "string") {
			return _scroller(ctx.value);
		}
		_scroller(ctx.value.el || ctx.value.element, ctx.value);
	}
	var VueScrollTo$1 = {
		bind: function bind(el, binding) {
			getBinding(el).binding = binding;
			_.on(el, "click", handleClick);
		},
		unbind: function unbind(el) {
			deleteBinding(el);
			_.off(el, "click", handleClick);
		},
		update: function update(el, binding) {
			getBinding(el).binding = binding;
		},
		scrollTo: _scroller,
		bindings: bindings
	};
	var install = function install(Vue, options) {
		if (options) setDefaults(options);
		Vue.directive("scroll-to", VueScrollTo$1);
		Vue.prototype.$scrollTo = VueScrollTo$1.scrollTo;
	};
	if (typeof window !== "undefined" && window.Vue) {
		window.VueScrollTo = VueScrollTo$1;
		window.VueScrollTo.setDefaults = setDefaults;
		Vue.use(install);
	}
	VueScrollTo$1.install = install;
	return VueScrollTo$1;
})));;
! function (e, n) {
	"object" == typeof exports && "undefined" != typeof module ? n(require("hammerjs")) : "function" == typeof define && define.amd ? define(["hammerjs"], n) : n(e.Hammer)
}(this, function (e) {
	"use strict";

	function n(e) {
		for (var n = [], t = arguments.length - 1; t-- > 0;) n[t] = arguments[t + 1];
		for (var i = 0; i < n.length; i++)
			for (var o = n[i], r = Object.keys(o), a = 0; a < r.length; a++) {
				var s = r[a];
				e[s] = o[s]
			}
		return e
	}

	function t() {
		return {
			type: Object,
			default: function () {
				return {}
			}
		}
	}

	function i(e) {
		return e.charAt(0).toUpperCase() + e.slice(1)
	}

	function o(n) {
		var t = n.direction;
		if ("string" == typeof t) {
			var i = "DIRECTION_" + t.toUpperCase();
			r.indexOf(t) > -1 && e.hasOwnProperty(i) ? n.direction = e[i] : console.warn("[vue-touch] invalid direction: " + t)
		}
		return n
	}
	e = "default" in e ? e.default : e;
	var r = ["up", "down", "left", "right", "horizontal", "vertical", "all"],
		a = {},
		s = {},
		p = ["pan", "panstart", "panmove", "panend", "pancancel", "panleft", "panright", "panup", "pandown", "pinch", "pinchstart", "pinchmove", "pinchend", "pinchcancel", "pinchin", "pinchout", "press", "pressup", "rotate", "rotatestart", "rotatemove", "rotateend", "rotatecancel", "swipe", "swipeleft", "swiperight", "swipeup", "swipedown", "tap"],
		c = {
			pan: "pan",
			panstart: "pan",
			panmove: "pan",
			panend: "pan",
			pancancel: "pan",
			panleft: "pan",
			panright: "pan",
			panup: "pan",
			pandown: "pan",
			pinch: "pinch",
			pinchstart: "pinch",
			pinchmove: "pinch",
			pinchend: "pinch",
			pinchcancel: "pinch",
			pinchin: "pinch",
			pinchout: "pinch",
			press: "press",
			pressup: "press",
			rotate: "rotate",
			rotatestart: "rotate",
			rotatemove: "rotate",
			rotateend: "rotate",
			rotatecancel: "rotate",
			swipe: "swipe",
			swipeleft: "swipe",
			swiperight: "swipe",
			swipeup: "swipe",
			swipedown: "swipe",
			tap: "tap"
		},
		l = {
			props: {
				options: t(),
				tapOptions: t(),
				panOptions: t(),
				pinchOptions: t(),
				pressOptions: t(),
				rotateOptions: t(),
				swipeOptions: t(),
				tag: {
					type: String,
					default: "div"
				},
				enabled: {
					default: !0,
					type: [Boolean, Object]
				}
			},
			mounted: function () {
				this.$isServer || (this.hammer = new e.Manager(this.$el, this.options), this.recognizers = {}, this.setupBuiltinRecognizers(), this.setupCustomRecognizers(), this.updateEnabled(this.enabled))
			},
			destroyed: function () {
				this.$isServer || this.hammer.destroy()
			},
			watch: {
				enabled: {
					deep: !0,
					handler: function () {
						for (var e = [], n = arguments.length; n--;) e[n] = arguments[n];
						(t = this).updateEnabled.apply(t, e);
						var t
					}
				}
			},
			methods: {
				setupBuiltinRecognizers: function () {
					for (var e = this, t = 0; t < p.length; t++) {
						var i = p[t];
						if (e._events[i]) {
							var o = c[i],
								r = n({}, a[o] || {}, e[o + "Options"]);
							e.addRecognizer(o, r), e.addEvent(i)
						}
					}
				},
				setupCustomRecognizers: function () {
					for (var e = this, t = Object.keys(s), i = 0; i < t.length; i++) {
						var o = t[i];
						if (e._events[o]) {
							var r = s[o],
								a = e[o + "Options"] || {},
								p = n({}, r, a);
							e.addRecognizer(o, p, {
								mainGesture: p.type
							}), e.addEvent(o)
						}
					}
				},
				addRecognizer: function (n, t, r) {
					void 0 === r && (r = {});
					var a = r.mainGesture;
					if (!this.recognizers[n]) {
						var s = new(e[i(a || n)])(o(t));
						this.recognizers[n] = s, this.hammer.add(s), s.recognizeWith(this.hammer.recognizers)
					}
				},
				addEvent: function (e) {
					var n = this;
					this.hammer.on(e, function (t) {
						return n.$emit(e, t)
					})
				},
				updateEnabled: function (e, n) {
					var t = this;
					if (e === !0) this.enableAll();
					else if (e === !1) this.disableAll();
					else if ("object" == typeof e)
						for (var i = Object.keys(e), o = 0; o < i.length; o++) {
							var r = i[o];
							t.recognizers[r] && (e[r] ? t.enable(r) : t.disable(r))
						}
				},
				enable: function (e) {
					var n = this.recognizers[e];
					n.options.enable || n.set({
						enable: !0
					})
				},
				disable: function (e) {
					var n = this.recognizers[e];
					n.options.enable && n.set({
						enable: !1
					})
				},
				toggle: function (e) {
					var n = this.recognizers[e];
					n && (n.options.enable ? this.disable(e) : this.enable(e))
				},
				enableAll: function (e) {
					this.toggleAll({
						enable: !0
					})
				},
				disableAll: function (e) {
					this.toggleAll({
						enable: !1
					})
				},
				toggleAll: function (e) {
					for (var n = this, t = e.enable, i = Object.keys(this.recognizers), o = 0; o < i.length; o++) {
						var r = n.recognizers[i[o]];
						r.options.enable !== t && r.set({
							enable: t
						})
					}
				},
				isEnabled: function (e) {
					return this.recognizers[e] && this.recognizers[e].options.enable
				}
			},
			render: function (e) {
				return e(this.tag, {}, this.$slots.default)
			}
		},
		u = !1,
		h = {
			config: a,
			customEvents: s
		};
	h.install = function (e, t) {
		void 0 === t && (t = {});
		var i = t.name || "v-touch";
		e.component(i, n(l, {
			name: i
		})), u = !0
	}.bind(h), h.registerCustomEvent = function (e, n) {
		return void 0 === n && (n = {}), u ? void console.warn("\n      [vue-touch]: Custom Event '" + e + "' couldn't be added to vue-touch.\n      Custom Events have to be registered before installing the plugin.\n      ") : (n.event = e, s[e] = n, void(l.props[e + "Options"] = {
			type: Object,
			default: function () {
				return {}
			}
		}))
	}.bind(h), h.component = l, "object" == typeof exports ? module.exports = h : "function" == typeof define && define.amd ? define([], function () {
		return h
	}) : "undefined" != typeof window && window.Vue && (window.VueTouch = h, Vue.use(h))
});;
Vue.directive('focus', {
	inserted: function (el) {
		el.focus();
	}
});;
Vue.filter('plural', function (count, array) {
	var i = [2, 0, 1, 1, 1, 2];
	return array[(count % 100 > 4 && count % 100 < 20) ? 2 : i[(count % 10 < 5) ? count % 10 : 5]];
});
Vue.filter('highlight', function (value, select) {
	return _.isEmpty(select) ? value : value.replace(new RegExp(select, 'gi'), function (match) {
		return '<span style="background-color: #ffe4857a">' + match + '</span>';
	});
});;
Vue.component('sliderSeries', {
	props: ['series'],
	data: function () {
		return {
			slider: {},
			images: [],
			imgKey: this.series[0].key,
			options: {
				slidesPerView: 6,
				spaceBetween: 30,
				breakpoints: {
					540: {
						slidesPerView: 1
					},
					864: {
						slidesPerView: 2
					},
					1024: {
						slidesPerView: 3
					},
					1200: {
						slidesPerView: 5
					}
				},
				autoplay: {
					delay: 5000,
					disableOnInteraction: false
				},
				speed: 900,
				loop: true,
				slideToClickedSlide: true,
				grabCursor: true
			}
		}
	},
	computed: {
		style: function () {
			return {
				'background-image': 'url(<?php echo get_template_directory_uri(); ?>/assets/css/images/slider/' + this.imgKey + '.jpg)'
			}
		}
	},
	mounted: function () {
		this.slider = this.$refs.sliderThumb.swiper;
		this.preload();
	},
	methods: {
		onSlideChange: function () {
			this.imgKey = this.series[this.slider.realIndex].key;
			this.preload();
		},
		preload: function () {
			var next = this.slider.realIndex + 1;
			if (_.has(this.series, next) && !_.has(this.images, next)) {
				this.images[next] = new Image();
				this.images[next].src = '' + mytheme.template_url + '/assets/css/images/slider/' + this.series[next].key + '.jpg';
			}
		}
	}
});
Vue.component('youtube', {
	props: ['uid'],
	data: function () {
		return {
			show: false,
			url: '//www.youtube.com/embed/' + this.uid + '?autoplay=1&controls=2&showinfo=0&rel=0'
		}
	}
});
Vue.component('svgMap', {
	props: {
		id: {
			type: String,
			default: 'mapSvg'
		},
		selected: {
			type: Array
		},
		code: {
			type: String
		}
	},
	data: function () {
		return {
			elTip: null
		}
	},
	template: '<div>' + '<div :id="id"></div>' + '<div :id="id + \'Tip\'"></div>' + '</div>',
	mounted: function () {
		var self = this;
		axios.get('/static/regions.json').then(function (response) {
			var map = Raphael(self.id, 862, 497, response.data.viewPort);
			for (var i in response.data.regions) {
				var region = response.data.regions[i],
					attr = {
						'fill': '#e8e9ed',
						'stroke': '#FFFFFF',
						'stroke-width': 1,
						'stroke-linejoin': 'round'
					};
				if (self.code === region.id) {
					attr = Object.assign({}, attr, {
						fill: '#ffc80a'
					});
				} else if (self.hasDealer(region.id)) {
					attr = Object.assign({}, attr, {
						fill: '#3862ba'
					});
				}
				if (region.paths !== undefined) {
					for (var p in region.paths) {
						var path = map.path(region.paths[p]).attr(attr);
						path.region = region;
						path.mouseover(self.onMouseOver);
						path.mouseout(self.onMouseOut);
						path.mousemove(self.onMouseMove);
						path.click(self.onClick);
					}
				}
				if (region.polygons !== undefined) {
					for (var p in region.polygons) {
						var polygon = map.path('M' + region.polygons[p]).attr(attr);
						polygon.region = region;
						polygon.mouseover(self.onMouseOver);
						polygon.mouseout(self.onMouseOut);
						polygon.mousemove(self.onMouseMove);
						polygon.click(self.onClick);
					}
				}
			}
			self.elTip = document.getElementById(self.id + 'Tip');
		});
	},
	methods: {
		regionData: function (code) {
			return _.find(this.selected, {
				code: code
			});
		},
		hasDealer: function (code) {
			return this.regionData(code).dealer;
		},
		onMouseOver: function (event) {
			var el = event.target.raphael,
				color = (this.code === el.region.id) ? '#f9b500' : (this.hasDealer(el.region.id) ? '#2d55a8' : '#dadbe2');
			el.node.setAttribute('fill', color);
			this.elTip.innerHTML = this.regionData(el.region.id).name;
			this.elTip.classList.add('active');
		},
		onMouseOut: function (event) {
			var el = event.target.raphael,
				color = (this.code === el.region.id) ? '#ffc80a' : (this.hasDealer(el.region.id) ? '#3862ba' : '#e8e9ed');
			el.node.setAttribute('fill', color);
			this.elTip.classList.remove('active');
		},
		onMouseMove: function (event) {
			this.elTip.style.top = event.pageY + 'px';
			this.elTip.style.left = event.pageX + 'px';
		},
		onClick: function (event) {
			window.location.assign('dealers');
		}
	}
});
Vue.component('glightbox', {
	props: {
		selector: {
			type: String,
			default: 'glightbox'
		}
	},
	data: function () {
		return {
			showMore: false
		}
	},
	mounted: function () {
		GLightbox({
			selector: this.selector,
			moreLength: 0
		});
	}
});
Vue.component('regions', {
	props: {
		show: {
			type: Boolean
		},
		code: {
			type: String
		},
		initCountry: {
			type: String
		},
		searchScroll: {
			type: String,
			default: ''
		}
	},
	data: function () {
		return {
			country: this.initCountry,
			filter: '',
			items: [],
			showMap: false
		}
	},
	mounted: function () {
		var self = this;
		axios.get('/api/regions').then(function (response) {
			self.items = response.data.data;
		});
	},
	watch: {
		filter: function () {
			if (this.searchScroll.length) this.$scrollTo(this.searchScroll, 1000);
		}
	},
	computed: {
		filterDelay: {
			get: function () {
				return this.filter;
			},
			set: _.debounce(function (val) {
				this.filter = val;
			}, 500)
		},
		markers: function () {
			format = function (data) {
				return {
					coords: data.marker,
					name: data.name
				};
			};
			return _.reduce(this.items, function (result, a) {
				if (_.has(a, 'sub')) {
					_.each(a.sub, function (b) {
						if (_.isArray(b)) {
							_.each(b, function (c) {
								if (c.dealer && c.marker) result.push(format(c));
							});
						} else {
							if (b.dealer && b.marker) result.push(format(b));
						}
					});
				} else {
					if (a.dealer && a.marker) result.push(format(a));
				}
				return result;
			}, []);
		},
		filteredItems: function () {
			var find = this.filter.toLowerCase();
			return _.reduce(this.items, function (result, a) {
				if (_.has(a, 'sub')) {
					var el = _.chain(a.sub).pickBy(function (b) {
						if (_.isArray(b)) {
							return _.some(b, function (c) {
								return (c.name.toLowerCase().indexOf(find) > -1 || c.city.toLowerCase().indexOf(find) > -1);
							});
						} else {
							return b.name.toLowerCase().indexOf(find) > -1;
						}
					}).mapValues(function (b) {
						return _.isArray(b) ? _.pickBy(b, function (c) {
							return (c.name.toLowerCase().indexOf(find) > -1 || c.city.toLowerCase().indexOf(find) > -1);
						}) : b;
					}).value();
					if (_.isEmpty(el)) {
						if (a.name.toLowerCase().indexOf(find) > -1) result.push(_.omit(a, 'sub'));
					} else {
						result.push({
							code: a.code,
							name: a.name,
							dealer: a.dealer,
							sub: el
						});
					}
				} else {
					if (a.name.toLowerCase().indexOf(find) > -1) result.push(a);
				}
				return result;
			}, []);
		}
	},
	methods: {
		set: function (code) {
			this.$emit('update:code', code);
			this.$emit('update:show', false);
		},
		showCountry: function (code) {
			if (_.isEmpty(this.country)) {
				return true;
			} else {
				if (this.country.charAt(0) === '-') {
					return (this.country.substring(1) !== code);
				} else {
					return (this.country === code);
				}
			}
		},
		filterMarker: function (event) {
			this.filter = event.originalEvent.target.properties.get('hintContent');
		},
		isNumeric: function (n) {
			return !isNaN(parseFloat(n)) && isFinite(n);
		}
	}
});
Vue.component('filterItems', {
	props: ['filter', 'items', 'swiper'],
	data: function () {
		return {
			roll: false,
			showAll: false
		}
	},
	computed: {
		selected: {
			get: function () {
				return this.filter;
			},
			set: function (val) {
				this.$emit('update:filter', val);
			}
		}
	},
	methods: {
		show: function (value, initShow) {
			return _.includes(this.selected, value) ? true : (this.showAll || initShow);
		},
		switchRoll: function () {
			this.roll = !this.roll;
			this.updSwiper();
		},
		switchShow: function () {
			this.showAll = !this.showAll;
			this.updSwiper();
		},
		updSwiper: function () {
			var self = this,
				el = document.getElementById('slideFilter');
			_.delay(function () {
				el.style.height = el.clientHeight + 'px';
				self.swiper.update();
			}, 500);
		}
	}
});
Vue.component('catalog', {
	props: {
		url: {
			type: String
		},
		page: {
			type: String
		},
		limit: {
			type: Number,
			default: 30
		},
		limitManual: {
			type: Number,
			default: 3
		},
		initDistance: {
			type: Number,
			default: 600
		},
		initFilter: {
			type: Object
		},
		initSort: {
			type: Array
		},
		isGallery: {
			type: Boolean,
			default: false
		},
		photoSelector: {
			type: String,
			default: 'glbPhoto'
		}
	},
	data: function () {
		return {
			distance: this.initDistance,
			filter: this.emptyFilter(true),
			loaded: false,
			order: '',
			items: [],
			total: 0,
			showSort: false,
			showFilter: false,
			writePage: true,
			glbox: null,
			swiper: {},
			swiperOpt: {
				direction: 'vertical',
				slidesPerView: 'auto',
				freeMode: true,
				grabCursor: true
			}
		}
	},
	created: function () {
		var self = this;
		page(function (ctx) {
			if (ctx.querystring.length) {
				var queryFilter = _.assign(self.emptyFilter(), Qs.parse(ctx.querystring));
				if (!_.isEqual(self.filter, queryFilter)) {
					self.writePage = false;
					self.filter = queryFilter;
				}
			} else {
				if (self.hasFilter) {
					self.writePage = false;
					self.clearFiler();
				}
			}
		});
		page();
	},
	mounted: function () {
		this.swiper = this.$refs.sliderFilter.swiper;
	},
	watch: {
		order: function () {
			this.infiniteReset();
		},
		filter: {
			handler: function () {
				this.loaded = false;
				this.changeFilter();
			},
			deep: true
		}
	},
	computed: {
		hasFilter: function () {
			return !_.isEmpty(_.omitBy(this.filter, _.isEmpty));
		},
		filterHuman: function () {
			var self = this;
			return _.reduce(this.filter, function (result, val, key) {
				if (key in self.initFilter) {
					if (_.isArray(self.initFilter[key])) {
						_.each(val, function (el) {
							result.push(_.chain(self.initFilter[key]).find({
								value: el
							}).pick('value', 'name').assign({
								type: key
							}).value());
						});
					} else {
						if (!_.isEmpty(val)) {
							result.push({
								value: val,
								name: val,
								type: key
							});
						}
					}
				}
				return result;
			}, []);
		},
		paramsCompact: function () {
			return _.omitBy({
				filter: _.omitBy(this.filter, _.isEmpty),
				order: this.order,
				limit: this.limit,
				offset: this.items.length
			}, function (n) {
				return _.isNumber(n) ? !n : _.isEmpty(n);
			});
		}
	},
	methods: {
		infiniteHandler: function ($state) {
			var self = this;
			axios.get('/api/' + this.url, {
				params: this.paramsCompact
			}).then(function (response) {
				self.loaded = true;
				self.total = response.data.total;
				if (response.data.data.length) {
					self.items = self.items.concat(response.data.data);
					$state.loaded();
					if (self.isGallery) {
						self.rebuildGallery();
					}
					if (self.items.length % self.limit !== 0) {
						$state.complete();
					} else if (self.items.length % (self.limit * self.limitManual) === 0) {
						self.distance = -Infinity;
					}
				} else {
					$state.complete();
				}
			});
		},
		fixAfterLeave: function () {
			this.$nextTick(function () {
				this.$refs.infiniteLoading.$emit('$InfiniteLoading:reset');
			});
		},
		infiniteReset: function () {
			this.items = [];
			this.$scrollTo('#anchorCatalog', 600);
			this.$nextTick(function () {
				this.distance = this.initDistance;
				this.$refs.infiniteLoading.$emit('$InfiniteLoading:reset');
			});
		},
		infiniteManualLoad: function () {
			this.$nextTick(function () {
				this.distance = this.initDistance;
				this.$refs.infiniteLoading.attemptLoad();
			});
		},
		changeFilter: _.debounce(function () {
			if (this.writePage) {
				page(this.page + Qs.stringify(_.omitBy(this.filter, _.isEmpty), {
					encode: false,
					addQueryPrefix: true,
					arrayFormat: 'brackets'
				}));
			} else {
				this.writePage = true;
			}
			this.infiniteReset();
		}, 600),
		emptyFilter: function (first) {
			var empty = _.reduce(this.initFilter, function (result, value, key) {
				result[key] = _.isArray(value) ? [] : '';
				return result;
			}, {});
			if (first === true) {
				return _.assign(empty, Qs.parse(window.location.search, {
					ignoreQueryPrefix: true
				}));
			} else {
				return empty;
			}
		},
		clearFiler: function (type, value) {
			if (_.isUndefined(type)) {
				this.filter = this.emptyFilter();
			} else {
				if (_.isArray(this.filter[type])) {
					this.filter[type].splice(this.filter[type].indexOf(value), 1);
				} else {
					this.filter[type] = '';
				}
			}
		},
		rebuildGallery: _.debounce(function () {
			if (this.glbox) {
				this.glbox.baseEvents.destroy();
			}
			this.glbox = GLightbox({
				selector: this.photoSelector,
				moreLength: 0
			});
		}, 1000)
	}
});
Vue.component('product-photos', {
	props: {
		photos: {
			type: Array
		},
		sketchfab: {
			type: String,
			default: ''
		}
	},
	mounted: function () {
		GLightbox({
			selector: 'glbImg',
			moreLength: 0
		});
		if (this.photos.length) {
			GLightbox({
				selector: 'glbPhoto',
				moreLength: 0
			});
		}
		if (this.sketchfab.length) {
			GLightbox({
				selector: 'glb3d',
				width: Math.round(window.innerWidth * 0.8),
				height: Math.round(window.innerHeight * 0.7),
				moreLength: 0
			});
		}
	}
});;
Vue.component('product-item', {
	props: ['prefix', 'data', 'loaded', 'search', 'tArt', 'tSeries', 'tAge', 'tQl', 'tQr'],
	template: '<a :href="prefix + \'/product/\' + data.id" class="catalogItem itemProduct" :class="{ itemFade: !loaded }">' + '<img :src="\'../css/images/product/\' + data.id + \'/600.jpg?\' + data.img" class="itemImg" :alt="data.art" />' + '<div class="itemArt">' + '{{ tArt }} <span v-html="$options.filters.highlight(data.art, search)"></span>' + '</div>' + '<h2 class="itemName" v-html="$options.filters.highlight(data.name, search)"></h2>' + '<div class="itemInfo">' + '<p>{{ tSeries }} {{ tQl }}{{ data.series }}{{ tQr }}</p>' + '<p v-if="data.age">{{ tAge }} {{ data.age }}</p>' + '</div>' + '</a>'
});
Vue.component('photo-item', {
	props: ['data', 'loaded', 'index', 'tSeries', 'tQl', 'tQr'],
	template: '<a :href="getUrl(1000)" class="catalogItem itemPhoto glbPhoto" :class="{ itemFade: !loaded }" :style="style">' + '<div class="glightbox-desc">' + '<a :href="\'/product/\' + data.product.id" class="itemName under alt1">' + '{{ data.product.name }} {{ data.product.art }}' + '</a>' + '<div class="itemSeries">{{ tSeries }} {{ tQl }}{{ data.series.name }}{{ tQr }}</div>' + '</div>' + '</a>',
	computed: {
		style: function () {
			return {
				'background-image': 'url(' + this.getUrl() + ')'
			}
		}
	},
	methods: {
		getUrl: function (size) {
			if (!size) size = ((this.index - 5) % 34 === 0 || (this.index - 22) % 34 === 0) ? '600-c' : '200-c';
			return '../css/images/product/' + this.data.product.id + '/photo/' + this.data.key + '-' + size + '.jpg';
		}
	}
});
Vue.component('cert-item', {
	props: ['data', 'index', 'showMore'],
	template: '<figure class="safetyItem" v-show="index <= 2 || showMore">' + '<a :href="\'../css/images/doc/\' + data.file + \'.jpg\'" class="safetyImg">' + '<img :src="\'../css/images/doc/\' + data.file + \'.thumb.jpg\'" alt="">' + '<div class="glightbox-desc" v-html="data.desc"></div>' + '</a>' + '<p v-html="data.desc"></p> ' + '</figure>'
});
Vue.component('dealer-item', {
	props: ['data', 'current'],
	template: '<div class="dealerItem" :class="{ myDealer: data.code === current }">' + '<h2>' + '{{ data.name }}' + '<span v-if="data.city">{{ data.city }}</span>' + '</h2>' + '<a :href="\'tel:\' +  data.dealer.phone" class="contData contPhone">' + '{{ data.dealer.phone }}' + '</a>' + '<a :href="\'tel:\' +  data.dealer.phoneAlt" class="contData contPhone contNoIcon" v-if="data.dealer.phoneAlt">' + '{{ data.dealer.phoneAlt }}' + '</a>' + '<div class="dealerSep"></div>' + '<a :href="\'mailto:\' +  data.dealer.email" class="contData contEmail">' + '{{ data.dealer.email }}' + '</a>' + '<a :href="\'mailto:\' +  data.dealer.emailAlt" class="contData contEmail contNoIcon" v-if="data.dealer.emailAlt">' + '{{ data.dealer.emailAlt }}' + '</a>' + '<div class="dealerSep"></div>' + '<a :href="data.dealer.siteUrl" target="_blank" rel="noopener" class="contData contLink" v-if="data.dealer.site">' + '{{ data.dealer.site }}' + '</a>' + '</div>'
});;
Vue.use(VueAwesomeSwiper);
Vue.use(VueScrollTo, {
	container: '#appWrap',
	duration: 1000
});
Vue.use(window['vue-js-modal'].default);
var app = new Vue({
	el: '#app',
	delimiters: ['${', '}'],
	data: {
		init: JSON.parse(document.getElementById('app').getAttribute('data-init')),
		region: Cookies.get('region') || null,
		showScroll: false,
		showRegions: false,
		showNavMore: false,
		showLangMenu: false,
		showMobileMenu: false
	},
	created: function () {
		page.base(this.init.url);
	},
	watch: {
		region: function (code) {
			Cookies.set('region', code, {
				expires: 30
			});
			if (code !== this.init.region) {
				window.location.reload();
			}
		},
		showRegions: function (show) {
			if (show) {
				this.$modal.show('regions');
			} else {
				this.$modal.hide('regions');
			}
		}
	},
	methods: {
		handleScroll: function () {
			var el = document.getElementById('appWrap');
			this.showScroll = (el.clientHeight <= el.scrollTop);
		}
	}
});;

  $(".hover").mouseleave(
    function () {
      $(this).removeClass("hover");
    }
  );