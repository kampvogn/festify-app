import '@polymer/paper-button/paper-button';
import '@polymer/paper-input/paper-input';
import '@polymer/paper-spinner/paper-spinner-lite';
import '@polymer/polymer/lib/elements/custom-style';
import { connect } from 'fit-html';
import { html } from 'lit-html';

import { triggerOAuthLogin } from '../actions/auth';
import { createPartyStart, joinPartyStart as joinParty } from '../actions/party-data';
import {
    changePartyId,
    changeCreatePartyName,
    showCreatePartyForm,
    hideCreatePartyForm,
    endPartyStart,
} from '../actions/view-home';
import { State, MyParty } from '../state';
import { currentAuthUser } from '../util/auth';
import { BackendUser } from '../util/backend-functions';
import { isSelfHostedBackend } from '../util/backend';
import festifyLogo from '../util/festify-logo';
import sharedStyles from '../util/shared-styles';

interface HomeViewProps {
    authorizationInProgress: boolean;
    authorizedAndPremium: boolean;
    authStatusKnown: boolean;
    partyCreationInProgress: boolean;
    partyCreationError: Error | null;
    partyId: string;
    partyIdValid: boolean;
    partyJoinError: Error | null;
    partyJoinInProgress: boolean;
    playerCompatible: boolean;
    backendUser: BackendUser | null;
    myParties: MyParty[] | null;
    myPartiesLoading: boolean;
    createPartyName: string;
    showCreateForm: boolean;
}
interface HomeViewDispatch {
    changePartyId: (partyId: string) => void;
    createParty: () => void;
    joinParty: () => void;
    loginWithSpotify: () => void;
    changeCreatePartyName: (name: string) => void;
    showCreatePartyForm: () => void;
    hideCreatePartyForm: () => void;
    endParty: (partyId: string) => void;
}

const PartyList = (props: HomeViewProps & HomeViewDispatch) => {
    if (props.myPartiesLoading) {
        return html`<paper-spinner-lite active></paper-spinner-lite>`;
    }

    const parties = props.myParties || [];

    return html`
        ${parties.length > 0 ? html`
            <div class="party-list">
                ${parties.map(p => html`
                    <div class="party-row">
                        <div class="party-info">
                            <span class="party-name">${p.name}</span>
                            <span class="party-code">#${p.short_id}</span>
                        </div>
                        <div class="party-actions">
                            <paper-button raised @click=${() => window.location.href = '/party/' + p.id}>
                                Enter
                            </paper-button>
                            <paper-button @click=${() => props.endParty(p.id)}>
                                End
                            </paper-button>
                        </div>
                    </div>
                `)}
            </div>
        ` : null}

        ${props.showCreateForm ? html`
            <div class="create-form">
                <paper-input
                    label="Party name"
                    .value=${props.createPartyName}
                    @input=${(ev: Event) => props.changeCreatePartyName((ev.target as HTMLInputElement).value)}
                    @keypress=${(ev: KeyboardEvent) => {
                        if (ev.key === 'Enter' && props.createPartyName.trim()) {
                            props.createParty();
                        }
                    }}
                    autofocus
                >
                </paper-input>
                <div class="create-form-buttons">
                    <paper-button raised
                        .disabled=${props.partyCreationInProgress || !props.createPartyName.trim()}
                        @click=${props.createParty}
                    >
                        ${props.partyCreationInProgress ? 'Creating...' : 'Create'}
                    </paper-button>
                    <paper-button @click=${props.hideCreatePartyForm}>Cancel</paper-button>
                </div>
            </div>
        ` : html`
            <paper-button raised @click=${props.showCreatePartyForm}>
                ${parties.length > 0 ? 'New Party' : 'Create Party'}
            </paper-button>
        `}
    `;
};

const LowerButton = (props: HomeViewProps & HomeViewDispatch) => {
    const isSelfHostedAnonymous = Boolean(props.backendUser && props.backendUser.isAnonymous);

    if (isSelfHostedAnonymous) {
        return html`
            <paper-button raised @click=${props.loginWithSpotify}>
                Login to create party
            </paper-button>
        `;
    } else if (props.authorizedAndPremium) {
        return PartyList(props);
    } else if (props.authorizationInProgress || !props.authStatusKnown) {
        return html`
            <paper-button raised disabled>
                Authorizing...
            </paper-button>
        `;
    } else {
        return html`
            <paper-button raised disabled>
                Spotify Premium required
            </paper-button>
        `;
    }
};

/* tslint:disable:max-line-length */
const HomeView = (props: HomeViewProps & HomeViewDispatch) => html`
    ${sharedStyles}
    <style>
        :host {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100%;
            padding: 0 10px;
            text-align: center;

            background: linear-gradient(rgba(28, 31, 36, 0.9), rgba(28, 31, 36, 0.9)),
                url(/home-bg.jpg) no-repeat center;
            background-size: cover;

            --paper-input-container-input: {
                font-size: 24px;
            }

            --paper-input-container-label: {
                font-size: 20px;
            }
        }

        paper-button[disabled] {
            opacity: 0.8;
        }

        svg {
            height: 180px;
            width: 180px;
        }

        p {
            padding: 0 25px;
            max-width: 500px;
            font-size: 20px;
        }

        main {
            display: flex;
            flex-flow: column nowrap;

            margin: 0 auto;
            min-width: 250px;
        }

        #middle {
            margin: 8px 0 16px 0;
        }

        .party-list {
            margin: 8px 0;
            width: 100%;
        }

        .party-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .party-info {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            text-align: left;
        }

        .party-name {
            font-size: 16px;
            font-weight: 500;
        }

        .party-code {
            font-size: 13px;
            opacity: 0.6;
        }

        .party-actions {
            display: flex;
            gap: 4px;
        }

        .create-form {
            margin-top: 8px;
            width: 100%;
        }

        .create-form-buttons {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }
    </style>

    <header>
        ${festifyLogo}
    </header>

    <p>Festify lets your guests choose which music should be played using their smartphones.</p>

    <main>
        <paper-input
            label="Party Code"
            type="tel"
            @input=${ev => props.changePartyId((ev.target as HTMLInputElement).value)}
            on-keypress="${(ev: KeyboardEvent) => {
                if (props.partyIdValid && ev.key === 'Enter') {
                    props.joinParty();
                }
            }}"
            value="${props.partyId}"
        >
        </paper-input>

        <paper-button id="middle" raised .disabled=${!props.partyIdValid} @click=${props.joinParty}>
            ${props.partyJoinInProgress ? 'Joining...' : 'Join Party'}
        </paper-button>

        ${props.playerCompatible ? LowerButton(props) : null}
    </main>
`;
/* tslint:enable */

const mapStateToProps = (state: State): HomeViewProps => {
    const backendUser = currentAuthUser() as BackendUser | null;

    return {
        ...state.homeView,
        authorizationInProgress: state.user.credentials.spotify.authorizing,
        authorizedAndPremium: isSelfHostedBackend
            ? Boolean(backendUser && !backendUser.isAnonymous && backendUser.spotifyIsPremium)
            : Boolean(
                  state.user.credentials.spotify.user &&
                      state.user.credentials.spotify.user.product === 'premium',
              ),
        authStatusKnown: state.user.credentials.spotify.statusKnown,
        playerCompatible: state.player.isCompatible,
        backendUser,
    };
};

const mapDispatchToProps: HomeViewDispatch = {
    changePartyId,
    createParty: createPartyStart,
    joinParty,
    loginWithSpotify: () => triggerOAuthLogin('spotify'),
    changeCreatePartyName,
    showCreatePartyForm,
    hideCreatePartyForm,
    endParty: endPartyStart,
};

customElements.define('view-home', connect(mapStateToProps, mapDispatchToProps)(HomeView));
