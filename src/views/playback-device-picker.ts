import '@polymer/paper-button/paper-button';
import '@polymer/paper-spinner/paper-spinner-lite';
import { connect } from 'fit-html';
import { html } from 'lit-html';

import {
    loadPlaybackDevicesStart,
    selectPlaybackDevice,
    transferPlaybackDeviceStart,
} from '../actions/playback-spotify';
import { isPartyOwnerSelector } from '../selectors/party';
import { hasConnectedSpotifyAccountSelector } from '../selectors/users';
import { State } from '../state';
import sharedStyles from '../util/shared-styles';

interface PlaybackDevicePickerProps {
    devices: SpotifyApi.UserDevice[];
    deviceLoadInProgress: boolean;
    deviceLoadError: Error | null;
    isOwner: boolean;
    isSpotifyConnected: boolean;
    selectedDeviceId: string | null;
    transferPlaybackInProgress: boolean;
}

interface PlaybackDevicePickerDispatch {
    refreshDevices: () => void;
    selectDevice: (deviceId: string | null) => void;
    transferPlayback: () => void;
}

const PlaybackDevicePicker = (
    props: PlaybackDevicePickerProps & PlaybackDevicePickerDispatch,
) => html`
    ${sharedStyles}
    <style>
        :host {
            display: block;
            padding: 0 8px 8px;
        }

        .row {
            align-items: center;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        label {
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0;
        }

        select {
            background: #1d2126;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 2px;
            color: white;
            flex: 1 1 260px;
            min-width: 0;
            padding: 8px 10px;
        }

        paper-button {
            color: white;
            margin: 0;
        }

        paper-button.transfer {
            background: var(--primary-color);
        }

        paper-button.refresh {
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.15);
        }

        paper-button[disabled] {
            opacity: 0.5;
        }

        .status {
            color: rgba(255, 255, 255, 0.65);
            font-size: 12px;
            margin-top: 6px;
        }

        .error {
            color: #ff9b9b;
        }

        .spinner {
            position: relative;
            width: 24px;
            height: 24px;
        }

        .spinner paper-spinner-lite {
            --paper-spinner-color: white;
            --paper-spinner-stroke-width: 2px;
            position: absolute;
            top: 0;
            left: 0;
        }
    </style>

    ${props.isOwner && props.isSpotifyConnected
        ? html`
              <div class="row">
                  <label for="playback-device">Playback device</label>
                  <select
                      id="playback-device"
                      .value=${props.selectedDeviceId || ''}
                      @change=${(ev: Event) =>
                          props.selectDevice((ev.target as HTMLSelectElement).value || null)}
                  >
                      <option value="">Choose device</option>
                      ${props.devices.map(
                          device => html`
                              <option value="${device.id}">
                                  ${device.name}${device.is_active ? ' (active)' : ''}
                                  ${device.type ? ` - ${device.type}` : ''}
                              </option>
                          `,
                      )}
                  </select>
                  <paper-button class="refresh" @click=${props.refreshDevices}>Reload</paper-button>
                  <paper-button
                      raised
                      class="transfer"
                      @click=${props.transferPlayback}
                      .disabled=${!props.selectedDeviceId || props.transferPlaybackInProgress}
                  >
                      ${props.transferPlaybackInProgress
                          ? html`
                                <span class="spinner"><paper-spinner-lite active></paper-spinner-lite></span>
                            `
                          : null}
                      <span>Transfer</span>
                  </paper-button>
              </div>
              ${props.deviceLoadError
                  ? html`<div class="status error">${props.deviceLoadError.message}</div>`
                  : null}
              ${!props.deviceLoadInProgress && !props.devices.length
                  ? html`<div class="status">No Spotify Connect devices found.</div>`
                  : null}
              ${props.deviceLoadInProgress
                  ? html`<div class="status">Loading Spotify devices...</div>`
                  : null}
          `
        : null}
`;

const mapStateToProps = (state: State): PlaybackDevicePickerProps => ({
    devices: state.player.availableDevices,
    deviceLoadError: state.player.deviceLoadError,
    deviceLoadInProgress: state.player.deviceLoadInProgress,
    isOwner: isPartyOwnerSelector(state),
    isSpotifyConnected: hasConnectedSpotifyAccountSelector(state),
    selectedDeviceId: state.player.selectedDeviceId,
    transferPlaybackInProgress: state.player.transferPlaybackInProgress,
});

const mapDispatchToProps: PlaybackDevicePickerDispatch = {
    refreshDevices: loadPlaybackDevicesStart,
    selectDevice: selectPlaybackDevice,
    transferPlayback: transferPlaybackDeviceStart,
};

customElements.define(
    'playback-device-picker',
    connect(mapStateToProps, mapDispatchToProps)(PlaybackDevicePicker),
);
