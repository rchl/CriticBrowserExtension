'use strict';

class Constants {
  static settingDescription(settingName) {
    switch (settingName) {
      case 'notifications':
        return 'Enable desktop notifications';
      case 'sslTunnel':
        return 'Use SSL tunnel';
      case 'devLinks':
        return 'Use critic-dev links (not effective when using SSL tunnel)';
      case 'singleLine':
        return 'Compact view (one line per review)';
      default:
        return '<missing description>';
    }
  }
};

Constants.CRITIC_BASE_URL = 'https://critic.oslo.osa/';
Constants.CRITIC_DEV_BASE_URL = 'https://critic-dev.oslo.osa/';
Constants.CRITIC_SSL_TUNNEL_BASE_URL = 'https://ssl.opera.com:8128/';
Constants.CRITIC_API_PATH = 'JsonDashboard/';
Constants.CRITIC_TOKEN_PATH = `${Constants.CRITIC_API_PATH}token`;
Constants.BADGE_COLOR_ACTIVE = '#ff0000';
Constants.BADGE_COLOR_INACTIVE = '#222222';
Constants.REFRESH_INTERVAL = 2 * 60 * 1000;  // 2 minutes.
Constants.LOGIN_MODE_CRITIC_STABLE = 0;
Constants.LOGIN_MODE_CRITIC_STABLE_SSL = 1;
Constants.LOGIN_MODE_CRITIC_DEV = 2;
