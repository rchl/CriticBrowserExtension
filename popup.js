'use strict';

class CriticPopup {
  constructor() {
    this.backgroundPage_ = null;
    this.mainElement_ = null;
    this.errorElement_ = null;
    EventHandler.register(
        'click', 'login', (event, target) => this.handleLogin_(event, target));
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
        'click', 'owner-name',
        (event, target) => this.handleOwnerNameClick_(event, target));
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
      document.body.cleanAppendTemplate(CriticPopup.Templates.loader());
      this.backgroundPage_ = bgWindow.background;
      this.backgroundPage_.ready().then(() => this.init_());
    });
  }

  init_() {
    this.updateMainView_();
    this.backgroundPage_.resetReadStatus();
  }

  updateMainView_() {
    if (this.backgroundPage_.loggedIn) {
      if (this.backgroundPage_.lastError) {
        this.onLoggedInWithError_(this.backgroundPage_.lastError);
      } else {
        this.onLoggedIn_();
      }
    } else {
      this.onLoggedOut_(this.backgroundPage_.lastError);
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
    let settings = this.backgroundPage_.settings;
    let formElement =
        document.body.cleanAppendTemplate(CriticPopup.Templates.loginView());
    this.errorElement_ = formElement.querySelector('#error-text');
    this.errorElement_.textContent = errorText;
    setTimeout(() => this.errorElement_.textContent = '', 3000);
  }

  onLoggedInWithError_(errorText) {
    document.body.cleanAppendTemplate(
        CriticPopup.Templates.loggedInErrorView(errorText));
  }

  handleReviewClick_(event, target) {
    let reviewId = target.getAncestorAttr('data-review-id');
    this.backgroundPage_.openReviewUrl(reviewId);
    event.cancelBubble = true;
  }

  handleUnreadCommentClick_(event, target) {
    let reviewId = target.getAncestorAttr('data-review-id');
    this.backgroundPage_.openUnreadCommentsUrl(reviewId);
    event.cancelBubble = true;
  }

  handleLineCountClick_(event, target) {
    let reviewId = target.getAncestorAttr('data-review-id');
    this.backgroundPage_.openPendingChangesUrl(reviewId);
    event.cancelBubble = true;
  }

  handleOpenIssuesClick_(event, target) {
    let reviewId = target.getAncestorAttr('data-review-id');
    this.backgroundPage_.openOpenIssuesUrl(reviewId);
    event.cancelBubble = true;
  }

  handleOwnerNameClick_(event, target) {
    this.backgroundPage_.openOwnerReviewsUrl(target.dataset.owner);
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
    let changed = this.backgroundPage_.state.getChangesFromLastSeen();
    for (let id of changed.pending) {
      let elements =
          document.querySelectorAll('.review-' + id + ' .line-count');
      Array.from(elements).forEach(element => {
        element.classList.add('highlight');
        setTimeout(() => element.classList.remove('highlight'), 1000);
      });
    }
    for (let id of changed.unread) {
      let elements =
          document.querySelectorAll('.review-' + id + ' .unread-count');
      Array.from(elements).forEach(element => {
        element.classList.add('highlight');
        setTimeout(() => element.classList.remove('highlight'), 1000);
      });
    }
    for (let id of changed.accepted) {
      let element = document.querySelector('.review-' + id);
      element.classList.add('highlight');
      setTimeout(() => element.classList.remove('highlight'), 1000);
    }
  }

  handleLogin_(event, target) {
    let loginMode = window.parseInt(target.dataset.loginMode, 10);
    this.backgroundPage_.openTokenPage(loginMode);
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
};

CriticPopup.Templates = class {
  static loader() {
    return ['div', {'class': 'loader'}, ['div', {'class': 'throbber-loader'}]];
  }

  static loginView() {
    return [
      'div',
      {'id': 'login-view'},
      [
        [
          'div', 'Choose how to log in to critic (affects links opened ' +
              'from the extension and can be changed later):'
        ],
        [
          'div',
          {'id': 'login-modes'},
          [
            [
              'div',
              {
                'data-handler': 'login',
                'class': 'stable-icon',
                'data-login-mode': `${Constants.LOGIN_MODE_CRITIC_STABLE}`,
              },
              'Critic stable',
            ],
          ],
          [
            [
              'div',
              {
                'data-handler': 'login',
                'class': 'stable-icon',
                'data-login-mode': `${Constants.LOGIN_MODE_CRITIC_STABLE_SSL}`,
              },
              'Critic stable through SSL tunnel',
            ],
          ],
          [
            [
              'div',
              {
                'data-handler': 'login',
                'class': 'dev-icon',
                'data-login-mode': `${Constants.LOGIN_MODE_CRITIC_DEV}`,
              },
              'Critic dev',
            ],
          ],
        ],
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
      {'id': 'settings-view'},
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
    return [
      'div', {
        'class': 'review pending review-' + review.id,
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
                lineCount + ' line(s)',
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
                unreadCount + ' comment(s)',
              ] :
              [],
        ],
      ],
      (settings.singleLine ?
           [] :
           [
             'div',
             {'class': 'second-review-line'},
             ['span', 'r/' + review.id],
             [
               'span',
               'Owner: ',
               review.owners.map(
                   owner => ['span', {
                     'class': 'owner-name',
                     'data-handler': 'owner-name',
                     'data-owner': owner.name,
                   },
                             owner.fullname]),
             ],
             (review.progress.openIssues ?
                  [
                    'span',
                    {
                      'class': 'link gray',
                      'data-handler': 'open-issues',
                      'tabIndex': '1',
                    },
                    'Issues: ' + String(review.progress.openIssues),
                  ] :
                  ['span']),
           ]),
      (review.progress.accepted ?
           [] :
           [
             'div', {
               'class': 'progress',
               'style': 'background-size: ' + progress + '% 100%'
             }
           ])
    ]
  }
};

document.addEventListener(
    'DOMContentLoaded', () => window.criticPopup = new CriticPopup());
