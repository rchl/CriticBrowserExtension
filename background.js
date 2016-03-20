'use strict';

class BackgroundPage {
  constructor() {
    this.settings_ = new Settings();
    this.loggedIn_ = false;
    this.lastError_ = '';
    this.dashboardData_ = null;
    this.refreshTimeout_ = null;
    this.state_ = new class {
      constructor() {
        this.unread_ = [];
        this.lastSeenUnread_ = [];
        this.lastCheckUnread_ = [];
        this.pending_ = [];
        this.lastSeenPending_ = [];
        this.lastCheckPending_ = [];
        this.accepted_ = [];
        this.lastSeenAccepted_ = [];
        this.lastCheckAccepted_ = [];
      }

      getChangesFromLastCheck() {
        return {
          'unread': this.getNewItems_(this.lastCheckUnread_, this.unread_),
          'pending': this.getNewItems_(this.lastCheckPending_, this.pending_),
          'accepted':
              this.getNewItems_(this.lastCheckAccepted_, this.accepted_),
        };
      }

      getChangesFromLastSeen() {
        return {
          'unread': this.getNewItems_(this.lastSeenUnread_, this.unread_),
          'pending': this.getNewItems_(this.lastSeenPending_, this.pending_),
          'accepted': this.getNewItems_(this.lastSeenAccepted_, this.accepted_),
        };
      }

      hasNewSinceLastCheck() {
        return this.getNewItems_(this.lastCheckUnread_, this.unread_).length ||
            this.getNewItems_(this.lastCheckPending_, this.pending_).length ||
            this.getNewItems_(this.lastCheckAccepted_, this.accepted_).length;
      }

      hasNewSinceLastSeen() {
        return this.getNewItems_(this.lastSeenUnread_, this.unread_).length ||
            this.getNewItems_(this.lastSeenPending_, this.pending_).length ||
            this.getNewItems_(this.lastSeenAccepted_, this.accepted_).length;
      }

      getNewItems_(oldArray, newArray) {
        return newArray.filter(item => oldArray.indexOf(item) === -1);
      }

      markAsLastCheckDone() {
        this.lastCheckUnread_ = this.unread_;
        this.lastCheckPending_ = this.pending_;
        this.lastCheckAccepted_ = this.accepted_;
      }

      markAsSeen() {
        this.lastSeenUnread_ = this.unread_;
        this.lastSeenPending_ = this.pending_;
        this.lastSeenAccepted_ = this.accepted_;
      }

      markUnreadAsSeen(reviewId) { this.lastSeenUnread_.push(reviewId); }

      markPendingAsSeen(reviewId) { this.lastSeenPending_.push(reviewId); }

      markAcceptedAsSeen(reviewId) { this.lastSeenAccepted_.push(reviewId); }
    };
    this.notificationsUrlMap_ = new Map();
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
  get lastError() { return this.lastError_; }

  init_() {
    return this.settings_.ready().then(() => {
      this.loggedIn_ =
          Boolean(this.settings_.getValue(Constants.PREFNAME_TOKEN));
      if (this.loggedIn_) {
        return this.refreshData_();
      }
    });
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
                (message, port) =>
                    this.handleLoginFromInjectedScript_(message));
          }
        });
  }

  handleLoginFromInjectedScript_(token) {
    this.settings_.setValue(Constants.PREFNAME_TOKEN, token);
    return this.getDashboardData_().then(() => {
      if (!this.lastError_) {
        this.settings_.save();
        this.scheduleNextCheck_();
      }
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
      }
    });
  }

  refreshData_() {
    return this.getDashboardData_().then(() => this.scheduleNextCheck_());
  }

  processData_() {
    let data = this.dashboardData_;
    this.state_.pending_ = data.active.hasPendingChanges;
    this.state_.unread_ = data.active.hasUnreadComments;
    this.state_.accepted_ = data.owned.accepted;
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
    if (this.loggedIn_ && !this.lastError_) {
      this.processData_();
    }
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
    if (this.state_.hasNewSinceLastCheck()) {
      let changes = this.state_.getChangesFromLastCheck();
      if (changes.pending.length) {
        for (let id of changes.pending) {
          let review = this.dashboardData_.all[id];
          chrome.notifications.create(
              undefined, {
                'type': 'basic',
                'iconUrl': 'images/128.png',
                'title': 'New changes',
                'message': review.summary,
                'isClickable': true,
              },
              id => this.notificationsUrlMap_.set(id, {
                'reviewId': review.id,
                'type': BackgroundPage.NOTIFICATION_TYPE_LINES,
              }));
        }
      }
      if (changes.unread.length) {
        for (let id of changes.unread) {
          let review = this.dashboardData_.all[id];
          let unreadCount = this.dashboardData_.active.unreadComments[id];
          chrome.notifications.create(
              undefined, {
                'type': 'basic',
                'iconUrl': 'images/128.png',
                'title': 'Unread comments (' + unreadCount + ')',
                'message': review.summary,
                'isClickable': true,
              },
              id => this.notificationsUrlMap_.set(id, {
                'reviewId': review.id,
                'type': BackgroundPage.NOTIFICATION_TYPE_COMMENTS,
              }));
        }
      }
      if (changes.accepted.length) {
        for (let id of changes.accepted) {
          let review = this.dashboardData_.all[id];
          chrome.notifications.create(
              undefined, {
                'type': 'basic',
                'iconUrl': 'images/128.png',
                'title': 'Accepted',
                'message': review.summary,
                'isClickable': true,
              },
              id => this.notificationsUrlMap_.set(id, {
                'reviewId': review.id,
                'type': BackgroundPage.NOTIFICATION_TYPE_REVIEW,
              }));
        }
      }
    }
  }

  onNotificationClicked_(notificationId) {
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
