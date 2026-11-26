import VDONinjaSDK from "@vdoninja/sdk";

export type VdoStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "joined"
  | "publishing"
  | "reconnecting"
  | "error"
  | "disconnected";

export interface VdoParticipant {
  uuid: string;
  streamID?: string;
  label?: string;
  connectionType?: "publisher" | "viewer";
  status?: "connected" | "disconnected";
}

export interface VdoEvents {
  onStatus?: (status: VdoStatus, detail?: string) => void;
  onTrack?: (event: { uuid: string; streamID?: string; track: MediaStreamTrack; streams: readonly MediaStream[] }) => void;
  onPeerConnected?: (peer: VdoParticipant) => void;
  onPeerDisconnected?: (peer: VdoParticipant) => void;
  onData?: (event: { uuid: string; data: unknown }) => void;
  onError?: (error: Error) => void;
}

export interface DeviceSelection {
  audioDeviceId?: string;
  videoDeviceId?: string;
}

export class VdoStudioClient {
  private sdk: VDONinjaSDK | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private events: VdoEvents;
  private status: VdoStatus = "idle";
  private listeners: Array<{ event: string; handler: EventListener }> = [];

  constructor(events: VdoEvents = {}) {
    this.events = events;
  }

  getStatus() { return this.status; }
  getLocalStream() { return this.localStream; }
  getScreenStream() { return this.screenStream; }

  private setStatus(status: VdoStatus, detail?: string) {
    this.status = status;
    this.events.onStatus?.(status, detail);
  }

  static async listDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      cameras: devices.filter((d) => d.kind === "videoinput"),
      microphones: devices.filter((d) => d.kind === "audioinput"),
      speakers: devices.filter((d) => d.kind === "audiooutput"),
    };
  }

  async connectAndPublish(opts: {
    room: string;
    streamID: string;
    label?: string;
    password?: string | false;
    salt?: string;
    host?: string;
    audio?: boolean;
    video?: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
  }) {
    await this.disconnect();

    const sdk = new VDONinjaSDK({
      room: opts.room,
      password: opts.password,
      salt: opts.salt ?? "vdo.ninja",
      host: opts.host ?? "wss://wss.vdo.ninja",
      debug: false,
    });
    this.sdk = sdk;
    this.bindEvents(sdk);

    this.setStatus("connecting");
    await sdk.connect();
    this.setStatus("connected");

    await sdk.joinRoom({ room: opts.room, password: opts.password });
    this.setStatus("joined");

    this.localStream = await this.createMediaStream({
      audio: opts.audio ?? true,
      video: opts.video ?? true,
      audioDeviceId: opts.audioDeviceId,
      videoDeviceId: opts.videoDeviceId,
    });

    await sdk.publish(this.localStream, {
      streamID: opts.streamID,
      room: opts.room,
      label: opts.label,
      password: opts.password,
    });
    this.setStatus("publishing", opts.streamID);
    return this.localStream;
  }

  private async createMediaStream(opts: { audio: boolean; video: boolean; audioDeviceId?: string; videoDeviceId?: string }) {
    const constraints: MediaStreamConstraints = {
      audio: opts.audio ? (opts.audioDeviceId ? { deviceId: { exact: opts.audioDeviceId } } : true) : false,
      video: opts.video ? (opts.videoDeviceId ? { deviceId: { exact: opts.videoDeviceId } } : true) : false,
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  async setMicEnabled(enabled: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  async setCamEnabled(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  async replaceCamera(deviceId: string) {
    if (!this.sdk || !this.localStream) throw new Error("Not connected");
    const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: false });
    const newTrack = newStream.getVideoTracks()[0];
    const oldTrack = this.localStream.getVideoTracks()[0];
    if (oldTrack) {
      await this.sdk.replaceTrack(oldTrack, newTrack);
      this.localStream.removeTrack(oldTrack);
      oldTrack.stop();
    } else {
      this.localStream.addTrack(newTrack);
    }
    this.localStream.addTrack(newTrack);
    // ensure no duplicate
    const vids = this.localStream.getVideoTracks();
    if (vids.length > 1) {
      const keep = newTrack;
      vids.forEach((t) => { if (t.id !== keep.id) { this.localStream?.removeTrack(t); } });
    }
    return this.localStream;
  }

  async replaceMicrophone(deviceId: string) {
    if (!this.sdk || !this.localStream) throw new Error("Not connected");
    const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } }, video: false });
    const newTrack = newStream.getAudioTracks()[0];
    const oldTrack = this.localStream.getAudioTracks()[0];
    if (oldTrack) {
      await this.sdk.replaceTrack(oldTrack, newTrack);
      this.localStream.removeTrack(oldTrack);
      oldTrack.stop();
    } else {
      this.localStream.addTrack(newTrack);
    }
    const auds = this.localStream.getAudioTracks();
    if (auds.length > 1) {
      const keep = newTrack;
      auds.forEach((t) => { if (t.id !== keep.id) { this.localStream?.removeTrack(t); } });
    }
    return this.localStream;
  }

  async startScreenShare() {
    if (!this.sdk || !this.localStream) throw new Error("Not connected");
    if (this.screenStream) return this.screenStream;
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const screenTrack = screen.getVideoTracks()[0];
    const oldCam = this.localStream.getVideoTracks()[0];
    if (screenTrack && oldCam) {
      await this.sdk.replaceTrack(oldCam, screenTrack);
      this.localStream.removeTrack(oldCam);
      oldCam.stop();
      this.localStream.addTrack(screenTrack);
    }
    screenTrack?.addEventListener("ended", () => { void this.stopScreenShare().catch(() => {}); });
    this.screenStream = screen;
    return screen;
  }

  async stopScreenShare(cameraDeviceId?: string) {
    if (!this.sdk || !this.localStream) return;
    const screenTrack = this.screenStream?.getVideoTracks()[0] || this.localStream.getVideoTracks()[0];
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : true, audio: false });
      const camTrack = camStream.getVideoTracks()[0];
      if (screenTrack && camTrack) {
        await this.sdk.replaceTrack(screenTrack, camTrack);
        if (this.localStream.getTracks().some((t) => t.id === screenTrack.id)) this.localStream.removeTrack(screenTrack);
        screenTrack.stop();
        this.localStream.addTrack(camTrack);
      }
    } catch (err) {
      this.events.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  async view(streamID: string, opts?: { audio?: boolean; video?: boolean; label?: string }) {
    if (!this.sdk) throw new Error("SDK not connected");
    return this.sdk.view(streamID, { audio: opts?.audio ?? true, video: opts?.video ?? true, label: opts?.label });
  }

  sendData(data: unknown, target?: string) {
    if (!this.sdk) return false;
    return this.sdk.sendData(data, target);
  }

  async disconnect() {
    const sdk = this.sdk;
    this.sdk = null;
    this.listeners.forEach(({ event, handler }) => { try { sdk?.removeEventListener(event as any, handler as any); } catch {} });
    this.listeners = [];

    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;

    if (sdk) {
      try { await sdk.disconnect(); } catch (err) { this.events.onError?.(err instanceof Error ? err : new Error(String(err))); }
    }
    this.setStatus("disconnected");
  }

  private on(sdk: VDONinjaSDK, event: string, handler: EventListener) {
    sdk.addEventListener(event as any, handler as any);
    this.listeners.push({ event, handler });
  }

  private bindEvents(sdk: VDONinjaSDK) {
    this.on(sdk, "peerConnected", ((e: any) => {
      this.events.onPeerConnected?.({ uuid: e.detail?.uuid, connectionType: e.detail?.connection?.type, status: "connected" });
    }) as EventListener);
    this.on(sdk, "peerDisconnected", ((e: any) => {
      this.events.onPeerDisconnected?.({ uuid: e.detail?.uuid, status: "disconnected" });
    }) as EventListener);
    this.on(sdk, "track", ((e: any) => {
      const detail = e.detail;
      if (!detail?.track) return;
      this.events.onTrack?.({ uuid: detail.uuid, streamID: detail.streamID, track: detail.track, streams: detail.streams ?? [] });
    }) as EventListener);
    this.on(sdk, "dataReceived", ((e: any) => {
      this.events.onData?.({ uuid: e.detail?.uuid, data: e.detail?.data });
    }) as EventListener);
    this.on(sdk, "peerInfo", ((e: any) => {
      const detail = e.detail;
      if (detail?.uuid) this.events.onPeerConnected?.({ uuid: detail.uuid, streamID: detail.streamID, label: detail.info?.label, status: "connected" });
    }) as EventListener);
    this.on(sdk, "reconnecting", (() => { this.setStatus("reconnecting"); }) as EventListener);
    this.on(sdk, "reconnected", (() => { this.setStatus("publishing", "reconnected"); }) as EventListener);
    this.on(sdk, "disconnected", ((e: any) => {
      const intentional = e.detail?.intentional;
      if (!intentional) this.setStatus("disconnected", e.detail?.reason || "unexpected disconnect");
    }) as EventListener);
    this.on(sdk, "connectionFailed", ((e: any) => { this.setStatus("error", e.detail?.reason || "connection failed"); }) as EventListener);
  }
}
