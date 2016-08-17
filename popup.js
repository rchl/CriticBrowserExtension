'use strict';

class CriticPopup {
  constructor() {
    this.contextMenuManager_ =
        ContextMenuManager.createForRoot(document, {'debuggingEnabled': true});
    this.backgroundPage_ = null;
    this.mainElement_ = null;
    this.backgroundPagePort_ = chrome.runtime.connect();
    this.backgroundPagePort_.onMessage.addListener(
        message => this.onBackgroundPageMessage_(message));
    this.contextMenuManager_.register(
        'review',
        (event, target) => this.handleReviewContextMenu_(event, target));
    EventHandler.register(
        'click', 'login', (event, target) => this.handleLogin_(event, target));
    EventHandler.register(
        'click', 'login-manual',
        (event, target) => this.handleLoginManual_(event, target));
    EventHandler.register(
        'submit', 'manual-login-submit',
        (event, target) => this.handleLoginManualSubmit_(event, target));
    EventHandler.register(
        'click', 'review',
        (event, target) => this.handleReviewClick_(event, target));
    EventHandler.register(
        'click', 'unread-count',
        (event, target) => this.handleUnreadCommentClick_(event, target));
    EventHandler.register(
        'click', 'line-count',
        (event, target) => this.handleLineCountClick_(event, target));
    EventHandler.register(
        'click', 'open-issues',
        (event, target) => this.handleOpenIssuesClick_(event, target));
    EventHandler.register(
        'click', 'settings-open',
        (event, target) => this.handleSettingsOpenClick_(event, target));
    EventHandler.register(
        'click', 'settings-close',
        (event, target) => this.handleSettingsCloseClick_(event, target));
    EventHandler.register(
        'click', 'setting-change',
        (event, target) => this.handleSettingChangeClick_(event, target));
    EventHandler.register(
        'click', 'logout',
        (event, target) => this.handleLogoutClick_(event, target));
    chrome.runtime.getBackgroundPage(bgWindow => {
      this.backgroundPage_ = bgWindow.background;
      this.backgroundPage_.ready().then(() => this.init_());
    });
    document.body.cleanAppendTemplate(CriticPopup.Templates.loader());
  }

  init_() {
    this.updateMainView_();
    this.backgroundPage_.resetReadStatus();
  }

  updateMainView_() {
    if (this.backgroundPage_.loggedIn) {
      if (this.backgroundPage_.getLastError()) {
        this.onLoggedInWithError_(this.backgroundPage_.getLastError());
      } else {
        this.onLoggedIn_();
      }
    } else {
      this.onLoggedOut_(this.backgroundPage_.getLastError());
    }
  }

  onBackgroundPageMessage_(message) {
    if (message.type === 'updated' &&
        document.body.querySelector('#main-view')) {
      this.updateMainView_();
    }
  }

  setLoginErrorText_(text) {
    let errorElement = document.getElementById('error-text');
    if (errorElement) {
      errorElement.textContent = text;
      setTimeout(() => errorElement.textContent = '', 3000);
    }
  }

  onLoggedIn_() {
    let data = this.backgroundPage_.data;
    let ownedAcceptedReviews = data.owned.accepted.map(id => data.all[id]);
    let ownedPendingReviews = data.owned.pending.map(id => data.all[id]);
    let reviewsTemplate = [
      this.createSectionTemplate_(
          ownedAcceptedReviews, data, 'Owned accepted', 'header-accepted'),
      this.createSectionTemplate_(
          ownedPendingReviews, data, 'Owned pending', 'header-owned-pending'),
    ];
    let seenIds = new Set(data.owned.accepted.concat(data.owned.pending));
    let pendingReviews = {};
    data.active.hasPendingChanges.forEach(id => {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        pendingReviews[id] = data.all[id];
      }
    });
    data.active.hasUnreadComments.forEach(id => {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        pendingReviews[id] = data.all[id];
      }
    });
    reviewsTemplate.push(
        this.createSectionTemplate_(
            pendingReviews, data, 'Pending', 'header-pending'));
    let mainTemplate = CriticPopup.Templates.mainView(reviewsTemplate);
    this.mainElement_ = document.body.cleanAppendTemplate(mainTemplate);
    this.highlightChanges_();
  }

  onLoggedOut_(errorText) {
    document.body.cleanAppendTemplate(CriticPopup.Templates.loginView());
    this.setLoginErrorText_(errorText);
  }

  onLoggedInWithError_(errorText) {
    document.body.cleanAppendTemplate(
        CriticPopup.Templates.loggedInErrorView(errorText));
  }

  handleReviewClick_(event, target) {
    let reviewId = target.getAncestorAttr('data-review-id');
    this.backgroundPage_.openReviewUrl(reviewId, event);
    event.cancelBubble = true;
  }

  handleUnreadCommentClick_(event, target) {
    let reviewId = target.getAncestorAttr('data-review-id');
    this.backgroundPage_.openUnreadCommentsUrl(reviewId, event);
    event.cancelBubble = true;
  }

  handleLineCountClick_(event, target) {
    let reviewId = target.getAncestorAttr('data-review-id');
    this.backgroundPage_.openPendingChangesUrl(reviewId, event);
    event.cancelBubble = true;
  }

  handleOpenIssuesClick_(event, target) {
    let reviewId = target.getAncestorAttr('data-review-id');
    this.backgroundPage_.openOpenIssuesUrl(reviewId, event);
    event.cancelBubble = true;
  }

  handleSettingsOpenClick_(event, target) {
    document.body.cleanAppendTemplate(
        CriticPopup.Templates.settingsView(this.backgroundPage_.settings));
    event.cancelBubble = true;
  }

  handleSettingsCloseClick_(event, target) {
    this.updateMainView_();
    event.cancelBubble = true;
  }

  handleSettingChangeClick_(event, target) {
    let settingName = target.dataset.prefName;
    let value;
    switch (target.type) {
      case 'checkbox':
        value = target.checked;
        break;
      case 'radio':
        value = target.value;
        break;
      default:
        console.error('Unhandled setting type!');
        break;
    }
    this.backgroundPage_.setSetting(settingName, value);
    event.cancelBubble = true;
  }

  handleLogoutClick_(event, target) {
    this.backgroundPage_.logOut();
    this.onLoggedOut_();
    event.cancelBubble = true;
  }

  createSectionTemplate_(reviews, data, title, className) {
    let template = [];
    for (let id in reviews) {
      let review = reviews[id];
      template.push(
          CriticPopup.Templates.review(
              review, this.getPendingChanges_(review.id, data),
              this.backgroundPage_.settings.toJSON()));
    }
    if (!template.length) {
      return [];
    }
    return [['h3', {'class': className}, title], template];
  }

  highlightChanges_() {
    let changed = this.backgroundPage_.getChangesFromLastSeen();
    for (let id of changed.pending) {
      let elements = document.querySelectorAll(`.review-${id} .line-count`);
      Array.from(elements).forEach(element => {
        element.classList.add('highlight');
        setTimeout(() => element.classList.remove('highlight'), 1000);
      });
    }
    for (let id of changed.unread) {
      let elements = document.querySelectorAll(`.review-${id} .unread-count`);
      Array.from(elements).forEach(element => {
        element.classList.add('highlight');
        setTimeout(() => element.classList.remove('highlight'), 1000);
      });
    }
    for (let id of changed.accepted) {
      let element = document.querySelector(`.review-${id}`);
      element.classList.add('highlight');
      setTimeout(() => element.classList.remove('highlight'), 1000);
    }
  }

  handleReviewContextMenu_(event, target) {
    return new ReviewContextMenu(target, this.backgroundPage_).getItems();
  }

  handleLogin_(event, target) {
    let loginMode = window.parseInt(target.dataset.loginMode, 10);
    this.backgroundPage_.openTokenPage(loginMode);
  }

  handleLoginManual_(event, target) {
    document.body.cleanAppendTemplate(CriticPopup.Templates.manualLoginView());
  }

  handleLoginManualSubmit_(event, target) {
    event.preventDefault();
    let elements = target.elements;
    let token =
        window.btoa(`${elements.username.value}:${elements.password.value}`);
    this.toggleFormElements_(target, false);
    let throbber =
        document.body.appendTemplate(CriticPopup.Templates.floatingLoader());
    this.backgroundPage_.loginWithToken(token).then(loggedIn => {
      if (loggedIn) {
        this.updateMainView_();
      } else {
        this.setLoginErrorText_(this.backgroundPage_.getLastError());
        this.toggleFormElements_(target, true);
        throbber.remove();
      }
    })
  }

  toggleFormElements_(form, enabled) {
    for (let element of Array.from(form.elements)) {
      element.disabled = !enabled;
    }
  }

  getPendingChanges_(reviewId, data) {
    let shared = data.active.sharedPendingChanges[reviewId];
    let unshared = data.active.unsharedPendingChanges[reviewId];
    let unreadCount = data.active.unreadComments[reviewId];
    let lineCount = 0;
    if (shared) {
      lineCount += shared.deleted + shared.inserted;
    }
    if (unshared) {
      lineCount += unshared.deleted + unshared.inserted;
    }
    return {
      'lineCount': lineCount ? String(lineCount) : undefined,
          'unreadCount': unreadCount ? String(unreadCount) : undefined,
    }
  }
}

CriticPopup.Templates = class {
  static loader() {
    return ['div', {'class': 'loader'}, ['div', {'class': 'throbber-loader'}]];
  }

  static floatingLoader() {
    return [
      'div', {'class': 'loader floating'},
      ['div', {'class': 'throbber-loader'}]
    ];
  }

  static loginView() {
    return [
      'div',
      {'class': 'view-container unselectable'},
      [
        [
          '#text',
          'Choose which critic instance you want to use. This will ' +
              'affect which instance the extension communicates with and ' +
              'how links are opened from the extension.',
        ],
        [
          'div',
          {
            'data-handler': 'login',
            'class': 'login-mode stable-icon',
            'data-login-mode': `${Constants.LOGIN_MODE_CRITIC_STABLE}`,
          },
          'Critic stable',
        ],
        [
          'div',
          {
            'data-handler': 'login',
            'class': 'login-mode dev-icon',
            'data-login-mode': `${Constants.LOGIN_MODE_CRITIC_DEV}`,
          },
          'Critic dev',
        ],
        [
          '#text', 'SSL tunnel option requires intranet credentials as ' +
              'opposed to other methods which use token authentication. ' +
              'Avoid if you can.'
        ],
        [
          'div', {
            'data-handler': 'login-manual',
            'class': 'login-mode stable-icon',
            'data-login-mode': `${Constants.LOGIN_MODE_CRITIC_STABLE_SSL}`,
          },
          'Critic stable through SSL tunnel'
        ],
        ['div', {'id': 'error-text'}],
      ],
    ];
  }

  static manualLoginView() {
    return [
      'div',
      {'class': 'view-container centered-content unselectable'},
      ['h3', 'Enter your intranet credentials'],
      [
        'form',
        {'data-handler': 'manual-login-submit', 'class': 'centered-form'},
        ['input', {'name': 'username', 'placeholder': 'Username'}],
        [
          'input',
          {'name': 'password', 'type': 'password', 'placeholder': 'Password'}
        ],
        ['button', 'Login'],
        ['div', {'id': 'error-text'}],
      ],
    ];
  }

  static loggedInErrorView(errorText) {
    return [
      'div', {'id': 'main-view'}, ['h3', {'class': 'header-error'}, errorText],
      [
        'footer', ['span'],
        ['button', {'class': 'logout', 'data-handler': 'logout'}, 'Logout']
      ]
    ];
  }

  static mainView(reviewsTemplate) {
    return [
      'div', {'id': 'main-view'}, reviewsTemplate,
      [
        'footer',
        [
          'button', {'class': 'settings', 'data-handler': 'settings-open'},
          'Settings'
        ],
      ]
    ];
  }

  static settingsView(settings) {
    return [
      'div',
      {'id': 'settings-view', 'class': 'unselectable'},
      ['h3', 'Settings'],
      ['div', settings.getSettingsTemplate()],
      [
        'footer', ['button', {'data-handler': 'settings-close'}, 'Go back'],
        ['button', {'class': 'logout', 'data-handler': 'logout'}, 'Logout']
      ],

    ];
  }

  static review(review, pendingChanges, settings) {
    let progress = String(review.progress.value);
    let lineCount;
    let unreadCount;
    if (pendingChanges.lineCount) {
      lineCount = String(pendingChanges.lineCount);
    }
    if (pendingChanges.unreadCount) {
      unreadCount = String(pendingChanges.unreadCount);
    }
    let owners = review.owners.map(owner => owner.name).join('|');
    let ownersFullname = review.owners.map(owner => owner.fullname).join(', ');
    return [
      'div', {
        'class': `review pending review-${review.id}`,
        'data-menu': 'review',
        'data-owners': owners,
        'data-review-id': String(review.id),
      },
      [
        'div',
        {
          'class': 'first-review-line',
          'data-handler': 'review',
        },
        [
          'span', {'class': 'link black grow ellipsis', 'tabIndex': '1'},
          review.summary
        ],
        [
          lineCount ?
              [
                'span',
                {
                  'class': 'line-count link',
                  'data-handler': 'line-count',
                  'tabIndex': '1',
                },
                `${lineCount} line(s)`,
              ] :
              [],
          unreadCount ?
              [
                'span',
                {
                  'class': 'unread-count link',
                  'data-handler': 'unread-count',
                  'tabIndex': '1',
                },
                `${unreadCount} comment(s)`,
              ] :
              [],
        ],
      ],
      (settings.singleLine ? [] :
                             [
                               'div',
                               {'class': 'second-review-line'},
                               ['span', `r/${review.id}`],
                               ['span', `Owner: ${ownersFullname}`],
                               (review.progress.openIssues ?
                                    [
                                      'span',
                                      {
                                        'class': 'link gray',
                                        'data-handler': 'open-issues',
                                        'tabIndex': '1',
                                      },
                                      `Issues: ${review.progress.openIssues}`,
                                    ] :
                                    ['span']),
                             ]),
      (review.progress.accepted ?
           [] :
           [
             'div', {
               'class': 'progress',
               'style': `background-size: ${progress}% 100%`
             }
           ])
    ]
  }
};

document.addEventListener(
    'DOMContentLoaded', () => window.criticPopup = new CriticPopup());
