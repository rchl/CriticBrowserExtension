"use strict";

var EventHandler = function(type, is_capturing, handler_key)
{
  return this._init(type, is_capturing, handler_key);
};

EventHandler.ESCAPE = "U+001B",
EventHandler.ENTER = "Enter";
EventHandler.TAB = "U+0009";

EventHandler.prototype = new function()
{
  var KEY = "data-handler";
  var _handlers = {"true": Object.create(null), "false": Object.create(null)};

  // static methods
  EventHandler.register = function(type, name, handler, is_capturing)
  {
    is_capturing = Boolean(is_capturing);
    (_handlers[is_capturing][type] ||
     new EventHandler(type, is_capturing))[name] = handler;
  };


  EventHandler.unregister = function(type, name, handler, is_capturing)
  {
    is_capturing = Boolean(is_capturing);
    var handler_map = _handlers[is_capturing][type];
    if (handler_map && handler_map[name] == handler)
        handler_map[name] = null;
  };

  EventHandler.redispatch_as = function(type, event, phase)
  {
    var handler_map = _handlers[Boolean(phase)] && _handlers[Boolean(phase)][type];
    if (handler_map)
      _handler(handler_map, event);
  };

  var _handler = function(handler_map, event)
  {
    var ele = event.target;
    while (ele && !event.cancelBubble)
    {
      var name = ele.getAttribute(KEY);
      if (name && handler_map[name])
        handler_map[name](event, ele);

      ele = ele.parentElement;
    }
  };

  this._init = function(type, is_capturing)
  {
    is_capturing = Boolean(is_capturing);
    if (_handlers[is_capturing][type])
      return _handlers[is_capturing][type];

    var handler_map = _handlers[is_capturing][type] = Object.create(null);
    var handler = _handler.bind(this, handler_map);
    document.addEventListener(type, handler, is_capturing);
    return handler_map;
  };
};
