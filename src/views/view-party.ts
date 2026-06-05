import '@polymer/app-layout/app-drawer-layout/app-drawer-layout';
import '@polymer/app-layout/app-drawer/app-drawer';
import '@polymer/app-layout/app-toolbar/app-toolbar';
import '@polymer/iron-icon/iron-icon';
import '@polymer/iron-pages/iron-pages';
import '@polymer/paper-dialog/paper-dialog';
import '@polymer/paper-icon-button/paper-icon-button';
import DomFlip from 'dom-flip';
import { connect } from 'fit-html';
import { html } from 'lit-html';

import { queueDragDrop, queueDragEnter, queueDragOver } from '../actions';
import { triggerOAuthLogin } from '../actions/auth';
import { changeDisplayLoginModal } from '../actions/view-party';
import { PartyViews } from '../routing';
import { Party, State } from '../state';
import sharedStyles from '../util/shared-styles';

import './party-queue';
import './party-search';
import './party-settings';
import './party-share';
import './playback-device-picker';
import './playback-progress-bar';
import './queue-drawer';
import './search-bar';

interface PartyViewProps {
    displayLoginModal: boolean;
    party:
        | Party
        | {
              created_by: string;
              name: string;
          };
    view: PartyViews;
}

interface PartyViewDispatch {
    closeLoginModal: () => void;
    trackDragEnter;
    trackDragOver;
    trackDragDrop;
    triggerSpotifyLogin: () => void;
}

/* tslint:disable:max-line-length */
const PartyView = (props: PartyViewProps & PartyViewDispatch) => html`
    ${sharedStyles}
    <style>
        :host {
            --track-bg: #22262b;
            --track-bg-even: #25292e;
        }

        app-drawer {
            z-index: 2;
        }

        header {
            background-color: #212121;
            overflow: hidden;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1;
        }

        header app-toolbar {
            height: 48px;
            padding: 8px;
        }

        header app-toolbar paper-icon-button {
            padding: 12px;

            width: 48px;
            height: 48px;

            --paper-icon-button-ink-color: white;
        }

        header app-toolbar div[main-title] {
            margin-right: 64px;
            text-align: center;
            flex-grow: 1;
        }

        header search-bar {
            margin: 8px 8px 16px;
        }

        header playback-progress-bar {
            bottom: 0;
            position: absolute;
            width: 100%;
        }

        iron-pages {
            padding-top: 220px;
        }

        app-drawer-layout:not([narrow]) [drawer-toggle] {
            display: none;
        }

        paper-dialog {
            background: var(--secondary-color);
        }

        paper-dialog-scrollable {
            display: block;
            padding: 0 2em;
            max-width: 300px;
            width: calc(100vw - 128px);
        }

        paper-dialog-scrollable paper-button {
            margin-bottom: 1em;
        }

        paper-dialog-scrollable paper-button:last-of-type {
            margin: 0;
        }

        paper-button.cancel {
            background: transparent;
        }

        @media (min-width: 641px) {
            header {
                left: 256px;
            }

            header app-toolbar div[main-title] {
                margin-right: 0;
            }
        }
    </style>

    <app-drawer-layout fullbleed>
        <app-drawer slot="drawer">
            <queue-drawer></queue-drawer>
        </app-drawer>

        <div>
            <header>
                <app-toolbar>
                    <paper-icon-button icon="festify:menu" drawer-toggle></paper-icon-button>
                    <div main-title>${props.party.name}</div>
                </app-toolbar>
                <search-bar></search-bar>
                <playback-device-picker></playback-device-picker>
                <playback-progress-bar></playback-progress-bar>
            </header>

            <iron-pages selected="${props.view}" attr-for-selected="view" role="main">
                <party-queue
                    view="${PartyViews.Queue}"
                    @dragenter=${props.trackDragEnter}
                    @drop=${props.trackDragDrop}
                    @dragover=${props.trackDragOver}
                >
                </party-queue>
                <party-search view="${PartyViews.Search}"></party-search>
                <party-settings view="${PartyViews.Settings}"></party-settings>
                <party-share view="${PartyViews.Share}"></party-share>
            </iron-pages>
        </div>
    </app-drawer-layout>

    <paper-dialog
        with-backdrop
        .opened=${props.displayLoginModal}
        @iron-overlay-canceled=${props.closeLoginModal}
    >
        <h2>Please sign in to vote</h2>

        <paper-dialog-scrollable>
            <p>The party owner requires all guests to sign in to prevent cheating, but you wouldn't do that anyway, would ya? 😛</p>

            <paper-button
                raised
                class="login spotify"
                @click=${props.triggerSpotifyLogin}
            >
                <iron-icon icon="social:spotify"></iron-icon>
                <span>Sign in with</span>
                Spotify
            </paper-button>
        </paper-dialog-scrollable>

        <div class="buttons">
            <paper-button class="cancel" @click=${props.closeLoginModal}>
                Cancel
            </paper-button>
        </div>
    </paper-dialog>
`;
/* tslint:enable */

const mapStateToProps = (state: State): PartyViewProps => ({
    displayLoginModal: state.partyView.loginModalOpen,
    party: state.party.currentParty || { created_by: '', name: '' },
    view: (state.router.result || { subView: PartyViews.Queue }).subView,
});
const mapDispatchToProps: PartyViewDispatch = {
    closeLoginModal: () => changeDisplayLoginModal(false),
    trackDragEnter: queueDragEnter,
    trackDragOver: queueDragOver,
    trackDragDrop: queueDragDrop,
    triggerSpotifyLogin: () => triggerOAuthLogin('spotify'),
};

const Base = connect(mapStateToProps, mapDispatchToProps)(PartyView);

class ViewParty extends Base {
    private queueFlip: DomFlip | null = null;
    private prevView: PartyViews | null = null;

    render() {
        super.render();

        /*
         * Update dom-flip positions after view switches to prevent jittering.
         */

        if (!this.queueFlip) {
            this.queueFlip = this.shadowRoot!.querySelector(
                'party-queue',
            )!.shadowRoot!.querySelector('dom-flip');
        }
        if (!this.queueFlip) {
            return;
        }

        const { view } = this.renderProps;
        if (this.prevView !== PartyViews.Queue && view === PartyViews.Queue) {
            this.queueFlip.refresh();
        }

        this.prevView = view;
    }
}

customElements.define('view-party', ViewParty);
