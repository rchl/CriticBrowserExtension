'use strict';

class Settings {
  constructor() {
    this.settings_ = new Map();
    this.readyPromise_ = this.init_();
  }

  ready() { return this.readyPromise_; }

  getValue(prefName) { return this.settings_.get(prefName).getValue(); }

  setValue(prefName, value) { this.settings_.get(prefName).setValue(value); }

  getSettingsTemplate() {
    let template = [];
    for (let [prefName, setting] of this.settings_) {
      if (setting.isExposedInUI_()) {
        template.push(setting.getTemplate());
      }
    }
    return template;
  }

  save() { chrome.storage.local.set(this.toJSON()); }

  toJSON() {
    let result = {};
    for (let [prefName, setting] of this.settings_) {
      result[prefName] = setting.getValue();
    }
    return result;
  }

  init_() {
    this.settings_.set(
        Constants.PREFNAME_NOTIFICATIONS,
        new BooleanSetting(
            Constants.PREFNAME_NOTIFICATIONS, true,
            'Enable desktop notifications'));
    this.settings_.set(
        Constants.PREFNAME_SINGLE_LINE,
        new BooleanSetting(
            Constants.PREFNAME_SINGLE_LINE, false,
            'Compact view (one line per review)'));
    this.settings_.set(
        Constants.PREFNAME_LOGIN_MODE,
        new MultiValueIntegerSetting(
            Constants.PREFNAME_LOGIN_MODE,
            [
              [Constants.LOGIN_MODE_CRITIC_STABLE, 'Critic stable'],
              [
                Constants.LOGIN_MODE_CRITIC_STABLE_SSL,
                'Critic stable through SSL tunnel'
              ],
              [Constants.LOGIN_MODE_CRITIC_DEV, 'Critic dev'],
            ],
            'Connection mode'));
    this.settings_.set(
        Constants.PREFNAME_TOKEN,
        new StringSetting(Constants.PREFNAME_TOKEN, ''));
    return this.readSettings_();
  }

  readSettings_() {
    return new Promise(
        resolve => chrome.storage.local.get(this.toJSON(), values => {
          for (let name in values) {
            this.settings_.get(name).setValue(values[name]);
          }
          resolve();
        }));
  }
}

class BaseSetting {
  constructor(name, value, title) {
    this.name_ = name;
    this.value_ = value;
    this.title_ = title;
  }

  get name() { return this.name_; }

  getValue() { return this.value_; }

  setValue(value) { console.error('Implement in subclass'); }

  isExposedInUI_() { return Boolean(this.title_); }

  getTemplate() { console.error('Implement in subclass'); }
}

class BooleanSetting extends BaseSetting {
  setValue(value) { this.value_ = Boolean(value); }

  getTemplate() {
    let attributes = {
      'type': 'checkbox',
      'data-handler': 'setting-change',
      'data-pref-name': this.name_,
      'checked': this.value_ ? 'true' : null,
    };
    return ['label', ['input', attributes], this.title_];
  }
}

class StringSetting extends BaseSetting {
  setValue(value) { this.value_ = String(value); }

  getTemplate() {
    let attributes = {
      'data-handler': 'setting-change',
      'data-pref-name': this.name_,
      'value': this.value_,
    };
    return ['label', [['#text', `${this.title_}: `], ['input', attributes]]];
  }
}

class MultiValueIntegerSetting extends BaseSetting {
  constructor(name, values, title) {
    super(name, values[0][0], title);
    this.values_ = values;
  }

  setValue(value) { this.value_ = window.parseInt(value, 10); }

  getTemplate() {
    let values = this.values_.map(valueArray => {
      let attributes = {
        'type': 'radio',
        'name': this.name_,
        'value': String(valueArray[0]),
        'data-handler': 'setting-change',
        'data-pref-name': this.name_,
        'checked': this.value_ === valueArray[0] ? 'true' : null,
      };
      return ['label', ['input', attributes], ['span', valueArray[1]]];
    });
    return ['div', ['div', `${this.title_}:`], values];
  }
}
