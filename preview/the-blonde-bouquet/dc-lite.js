/* dc-lite: renders the prototype's page templates in a normal browser.
   Each page ships its template in <template id="dc-tpl"> and its original
   Component class; this file supplies DCLogic, holes, sc-for, sc-if,
   events, and an in-place DOM update so inputs and animations survive. */
(function () {
  'use strict';
  var inst = null, tpl = null, root = null, queued = false;

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (p, cb) {
    var next = typeof p === 'function' ? p(this.state, this.props) : p;
    this.state = Object.assign({}, this.state, next);
    schedule();
    if (cb) Promise.resolve().then(cb);
  };
  DCLogic.prototype.forceUpdate = function () { schedule(); };
  window.DCLogic = DCLogic;

  function schedule() {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () { queued = false; render(); });
  }

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function lookup(path, scopes) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var q = path.match(/^(['"])(.*)\1$/);
    if (q) return q[2];
    var parts = path.split('.');
    var head = parts[0], cur;
    for (var i = 0; i < scopes.length; i++) {
      var s = scopes[i];
      if (s != null && head in Object(s)) { cur = s[head]; break; }
    }
    for (var k = 1; k < parts.length; k++) {
      if (cur == null) return undefined;
      cur = cur[parts[k]];
    }
    return cur;
  }

  function interp(str, scopes) {
    return str.replace(HOLE, function (_, p) {
      var v = lookup(p, scopes);
      return v == null || v === false ? '' : String(v);
    });
  }

  function eventName(attr, el) {
    var n = attr.slice(2);
    if (n === 'change') {
      var t = (el.getAttribute('type') || '').toLowerCase();
      if ((el.localName === 'input' && t !== 'checkbox' && t !== 'radio') || el.localName === 'textarea') return 'input';
    }
    if (n === 'doubleclick') return 'dblclick';
    return n;
  }

  function bind(el, type) {
    el.__dcb = el.__dcb || {};
    if (el.__dcb[type]) return;
    el.__dcb[type] = true;
    el.addEventListener(type, function (e) {
      var f = el.__dc && el.__dc[type];
      if (typeof f === 'function') f(e);
    });
  }

  function build(nodes, scopes, parent) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.nodeType === 3) { parent.appendChild(document.createTextNode(interp(n.nodeValue, scopes))); continue; }
      if (n.nodeType !== 1) continue;
      var tag = n.localName;
      if (tag === 'sc-for') {
        var list = lookup((n.getAttribute('list') || '').replace(WHOLE, '$1'), scopes) || [];
        var as = n.getAttribute('as') || 'item';
        for (var j = 0; j < list.length; j++) {
          var sc = {}; sc[as] = list[j]; sc.$index = j;
          build(n.childNodes, [sc].concat(scopes), parent);
        }
        continue;
      }
      if (tag === 'sc-if') {
        if (lookup((n.getAttribute('value') || '').replace(WHOLE, '$1'), scopes)) build(n.childNodes, scopes, parent);
        continue;
      }
      var el = n.namespaceURI && n.namespaceURI !== 'http://www.w3.org/1999/xhtml'
        ? document.createElementNS(n.namespaceURI, n.localName)
        : document.createElement(tag);
      for (var a = 0; a < n.attributes.length; a++) {
        var at = n.attributes[a], name = at.name, val = at.value, m = val.match(WHOLE);
        if (/^on[a-z]+$/.test(name)) {
          if (m) {
            el.__dc = el.__dc || {};
            var type = eventName(name, n);
            el.__dc[type] = lookup(m[1], scopes);
            bind(el, type);
          }
          continue;
        }
        if (m) {
          var v = lookup(m[1], scopes);
          if (/^(aria|data)-/.test(name)) { if (v != null) el.setAttribute(name, String(v)); continue; }
          if (v === false || v == null) continue;
          el.setAttribute(name, v === true ? '' : String(v));
        } else {
          el.setAttribute(name, val.indexOf('{{') >= 0 ? interp(val, scopes) : val);
        }
      }
      if (tag === 'input' && el.hasAttribute('value')) el.value = el.getAttribute('value');
      build(tag === 'template' ? n.content.childNodes : n.childNodes, scopes, el);
      parent.appendChild(el);
    }
  }

  function sameKind(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
    if (a.nodeType !== 1) return true;
    if (a.namespaceURI !== b.namespaceURI) return false;
    return a.getAttribute('aria-label') === b.getAttribute('aria-label') && a.id === b.id;
  }

  function morph(a, b) {
    if (!sameKind(a, b)) { a.parentNode.replaceChild(b, a); return; }
    if (a.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    var i, at;
    for (i = a.attributes.length - 1; i >= 0; i--) { at = a.attributes[i]; if (!b.hasAttribute(at.name)) a.removeAttribute(at.name); }
    for (i = 0; i < b.attributes.length; i++) { at = b.attributes[i]; if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); }
    if (a.localName === 'input' && b.hasAttribute('value') && a.value !== b.getAttribute('value')) a.value = b.getAttribute('value');
    a.__dc = b.__dc;
    if (a.__dc) for (var t in a.__dc) bind(a, t);
    morphChildren(a, b);
  }

  function morphChildren(oldP, newP) {
    var o = Array.prototype.slice.call(oldP.childNodes), n = Array.prototype.slice.call(newP.childNodes);
    for (var i = 0; i < n.length; i++) {
      if (i < o.length) morph(o[i], n[i]); else oldP.appendChild(n[i]);
    }
    for (var j = n.length; j < o.length; j++) oldP.removeChild(o[j]);
  }

  function render() {
    var vals;
    try { vals = inst.renderVals(); } catch (e) { console.error(e); return; }
    var frag = document.createElement('div');
    build(tpl.content.childNodes, [vals], frag);
    morphChildren(root, frag);
  }

  window.DCLite = {
    mount: function (Comp, props) {
      tpl = document.getElementById('dc-tpl');
      root = document.getElementById('dc-root');
      inst = new Comp(props || {});
      render();
      if (typeof inst.componentDidMount === 'function') inst.componentDidMount();
    }
  };
})();
