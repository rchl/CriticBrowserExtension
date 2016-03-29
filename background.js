'use strict';

class BackgroundPage {
  constructor() {
    this.settings_ = new Settings();
    this.loggedIn_ = false;
    this.lastError_ = '';
    this.dashboardData_ = null;
    this.refreshTimeout_ = null;
    this.state_ = new StateHandler();
    this.notificationsUrlMap_ = new Map();
    this.popupPort_ = null;
    // Set to true on manual or initial login to only show a summary of changes
    // in notifications.
    this.initialLogin_ = true;
    chrome.runtime.onConnect.addListener(port => this.onConnect_(port));
    chrome.notifications.onClicked.addListener(
        id => this.onNotificationClicked_(id));
    this.ready_ = this.init_();
  }

  ready() { return this.ready_; }

  get settings() { return this.settings_; }

  get data() { return this.dashboardData_; }

  /**
   * Whether in logged in state.
   *
   * Logged in state doesn't guarantee that there is valid data available. It
   * only indicates that login credentials are saved.
   */
  get loggedIn() { return this.loggedIn_; }

  /**
   * Whether last check resulted in an error.
   *
   * No data is available in error state. Can be set either in logged in or out
   * state.
   */
  getLastError() {
    let error = this.lastError_;
    if (!this.loggedIn_) {
      this.lastError_ = null;
    }
    return error;
  }

  init_() {
    return this.settings_.ready().then(() => {
      this.loggedIn_ =
          Boolean(this.settings_.getValue(Constants.PREFNAME_TOKEN));
      if (this.loggedIn_) {
        return this.refreshData_();
      }
    });
  }

  onConnect_(port) {
    this.popupPort_ = port;
    port.onDisconnect.addListener(port => this.popupPort_ = null);
  }

  getChangesFromLastSeen() { return this.state_.getChangesFromLastSeen(); }

  openTokenPage(loginMode) {
    this.setSetting(Constants.PREFNAME_LOGIN_MODE, loginMode);
    let url = `${this.baseUrl_()}${Constants.CRITIC_TOKEN_PATH}`;
    new Promise(resolve => chrome.tabs.create({url}, resolve))
        .then(tab => {
          let injectOptions = {
            'file': 'login_helper.js',
            'runAt': 'document_start'
          };
          return new Promise(
              resolve =>
                  chrome.tabs.executeScript(tab.id, injectOptions, () => {
                    if (chrome.runtime.lastError) {
                      return null;
                    }
                    resolve(tab);
                  }));
        })
        .then(tab => {
          if (tab) {
            let port = chrome.tabs.connect(tab.id);
            port.onMessage.addListener(
                (message, port) => this.loginWithToken(message));
          }
        });
  }

  loginWithToken(token) {
    this.initialLogin_ = true;
    this.settings_.setValue(Constants.PREFNAME_TOKEN, token);
    return this.getDashboardData_().then(() => {
      if (!this.lastError_) {
        this.settings_.save();
        this.scheduleNextCheck_();
      }
      return this.loggedIn_;
    });
  }

  getDashboardData_() {
    return this.requestData().then(data => {
      if (this.lastError_) {
        this.onRefreshError_();
      } else {
        this.loggedIn_ = true;
        this.dashboardData_ = data;
        this.processData_();
        this.initialLogin_ = false;
      }
    });
  }

  refreshData_() {
    return this.getDashboardData_().then(() => this.scheduleNextCheck_());
  }

  processData_() {
    let data = this.dashboardData_;
    this.state_.updateState({
      'unread': data.active.hasUnreadComments,
      'pending': data.active.hasPendingChanges,
      'accepted': data.owned.accepted,
    });
    let changesCount = data.active.hasPendingChanges.length +
        data.active.hasUnreadComments.length + data.owned.accepted.length;
    chrome.browserAction.setBadgeText(
        {'text': changesCount ? String(changesCount) : ''});
    if (changesCount > 0) {
      this.updateBadgeColor_();
      if (this.settings_.getValue(Constants.PREFNAME_NOTIFICATIONS)) {
        this.triggerNotifications_();
      }
    }
    this.state_.markAsLastCheckDone();
    if (this.popupPort_) {
      this.popupPort_.postMessage({'type': 'updated'});
    }
  }

  onRefreshError_() {
    this.dashboardData_ = null;
    chrome.browserAction.setBadgeText({'text': this.loggedIn_ ? 'ERR' : ''});
  }

  scheduleNextCheck_() {
    window.clearTimeout(this.refreshTimeout_);
    this.refreshTimeout_ =
        setTimeout(() => this.refreshData_(), Constants.REFRESH_INTERVAL);
  }

  resetReadStatus() {
    this.state_.markAsSeen();
    this.updateBadgeColor_();
  }

  setSetting(name, value) {
    this.settings_.setValue(name, value);
    this.settings_.save();
  }

  openReviewUrl(reviewId) { this.openUrl_(this.reviewUrl_(reviewId)); }

  openPendingChangesUrl(reviewId) {
    this.openUrl_(this.pendingChangesUrl_(reviewId));
  }

  openUnreadCommentsUrl(reviewId) {
    this.openUrl_(this.unreadCommentsUrl_(reviewId));
    // Opening unread URL marks them as read so trigger update shortly after
    // opening to make the state match.
    setTimeout(() => this.refreshData_(), 3000);
  }

  openOpenIssuesUrl(reviewId) {
    let url = this.baseUrl_() + 'showcomments?review=' + reviewId +
        '&filter=open-issues';
    this.openUrl_(url);
  }

  openOwnerReviewsUrl(owner) {
    let url = this.baseUrl_() + 'search?qowner=%27' + owner + '%27';
    this.openUrl_(url);
  }

  reviewUrl_(reviewId) { return this.baseUrl_() + 'r/' + reviewId; }

  pendingChangesUrl_(reviewId) {
    return this.baseUrl_() + 'showcommit?review=' + reviewId +
        '&filter=pending';
  }

  unreadCommentsUrl_(reviewId) {
    return this.baseUrl_() + 'showcomments?review=' + reviewId +
        '&filter=toread';
  }

  openUrl_(url) {
    chrome.tabs.query(
        {url},
        tabs => {
          if (tabs.length) {
            chrome.tabs.update(tabs[0].id, {'url': url, 'active': true});
          } else {
            chrome.tabs.create({url});
          }
        });
  }

  baseUrl_() {
    let baseUrl = Constants.CRITIC_BASE_URL;
    let loginMode = this.settings_.getValue(Constants.PREFNAME_LOGIN_MODE);
    if (loginMode === Constants.LOGIN_MODE_CRITIC_STABLE_SSL) {
      baseUrl = Constants.CRITIC_SSL_TUNNEL_BASE_URL;
    } else if (loginMode === Constants.LOGIN_MODE_CRITIC_DEV) {
      baseUrl = Constants.CRITIC_DEV_BASE_URL;
    }
    return baseUrl;
  }

  updateBadgeColor_() {
    chrome.browserAction.setBadgeBackgroundColor({
      'color': this.state_.hasNewSinceLastSeen() ?
          Constants.BADGE_COLOR_ACTIVE :
          Constants.BADGE_COLOR_INACTIVE
    });
  }

  triggerNotifications_() {
    if (!this.state_.hasNewSinceLastCheck()) {
      return;
    }
    let changes = this.state_.getChangesFromLastCheck();
    if (this.initialLogin_) {
      let title = 'Critic summary';
      let summary = [];
      for (let key of Object.keys(changes)) {
        let changesCount = changes[key].length;
        if (changesCount === 0) {
          continue;
        }
        if (key === 'unread') {
          summary.push('Reviews with unread comments: ' + changesCount);
        } else if (key === 'pending') {
          summary.push('Reviews with pending changes: ' + changesCount);
        } else if (key === 'accepted') {
          summary.push('Reviews accepted: ' + changesCount);
        }
      }
      if (summary.length) {
        chrome.notifications.create(undefined, {
          'type': 'basic',
          'iconUrl': 'images/128.png',
          'title': title,
          'message': summary.join('\n'),
          'isClickable': true,
        });
      }
    } else {
      for (let key of Object.keys(changes)) {
        for (let id of changes[key]) {
          let review = this.dashboardData_.all[id];
          let title;
          let type;
          switch (key) {
            case 'unread':
              let unreadCount = this.dashboardData_.active.unreadComments[id];
              title = 'Unread comments (' + unreadCount + ')';
              type = BackgroundPage.NOTIFICATION_TYPE_COMMENTS;
              break;
            case 'pending':
              title = 'New changes';
              type = BackgroundPage.NOTIFICATION_TYPE_LINES;
              break;
            case 'accepted':
              title = 'Accepted';
              type = BackgroundPage.NOTIFICATION_TYPE_REVIEW;
              break;
            default:
              console.error('Unexpected key in changes object!');
              break;
          }
          chrome.notifications.create(
              undefined, {
                'type': 'basic',
                'iconUrl': 'images/128.png',
                'title': title,
                'message': review.summary,
                'isClickable': true,
              },
              id => this.notificationsUrlMap_.set(id, {
                'reviewId': review.id,
                'type': type,
              }));
        }
      }
    }
  }

  onNotificationClicked_(notificationId) {
    // Might not be in a map if it's a summary notification.
    if (!this.notificationsUrlMap_.has(notificationId)) {
      return;
    }
    let data = this.notificationsUrlMap_.get(notificationId);
    this.notificationsUrlMap_.delete(notificationId);
    let url;
    switch (data.type) {
      case BackgroundPage.NOTIFICATION_TYPE_LINES:
        url = this.pendingChangesUrl_(data.reviewId);
        this.state_.markPendingAsSeen(data.reviewId);
        break;
      case BackgroundPage.NOTIFICATION_TYPE_COMMENTS:
        url = this.unreadCommentsUrl_(data.reviewId);
        this.state_.markUnreadAsSeen(data.reviewId);
        break;
      case BackgroundPage.NOTIFICATION_TYPE_REVIEW:
        url = this.reviewUrl_(data.reviewId);
        this.state_.markAcceptedAsSeen(data.reviewId);
        break;
      default:
        console.error('Unhandled type!');
    }
    this.updateBadgeColor_();
    chrome.tabs.create({url});
    chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, {'focused': true});
  }

  logOut() {
    this.setSetting(Constants.PREFNAME_TOKEN, '');
    this.loggedIn_ = false;
    this.onRefreshError_();
  }

  requestData(path = '') {
    let headers = new Headers();
    let token = this.settings_.getValue(Constants.PREFNAME_TOKEN);
    headers.append('Authorization', `Basic ${token}`);
    return window
        .fetch(this.baseUrl_() + Constants.CRITIC_API_PATH + path, {headers})
        .then(response => {
          if (!response.ok) {
            this.lastError_ = response.statusText;
            return null;
          }
          this.lastError_ = '';
          return response.json();
        }, error => this.lastError_ = error.message);
  }
}

BackgroundPage.NOTIFICATION_TYPE_COMMENTS = 0;
BackgroundPage.NOTIFICATION_TYPE_LINES = 1;
BackgroundPage.NOTIFICATION_TYPE_REVIEW = 2;

window.background = new BackgroundPage();
