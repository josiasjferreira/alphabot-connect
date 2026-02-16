import { useState, useRef, useCallback } from 'react';

export interface RecordingSession {
  id: string;
  audioBlob: Blob | null;
  photoBlob: Blob | null;
  photoUrl: string | null;
  timestamp: Date;
  productId: string;
  clientName: string;
}

const STORAGE_KEY = 'alphabot-recordings';

/** Save recording metadata to localStorage (blobs as data URLs) */
const saveRecording = async (session: RecordingSession) => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const entry: any = {
      id: session.id,
      timestamp: session.timestamp.toISOString(),
      productId: session.productId,
      clientName: session.clientName,
    };
    if (session.photoBlob) {
      entry.photoDataUrl = await blobToDataUrl(session.photoBlob);
    }
    // Audio blobs can be large — store only metadata for now
    if (session.audioBlob) {
      entry.hasAudio = true;
      entry.audioDuration = session.audioBlob.size;
    }
    saved.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.slice(-50)));
  } catch (e) {
    console.error('Failed to save recording:', e);
  }
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export const useMediaRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = blob;
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = blob;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIsRecording(false);
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const capturePhoto = useCallback(async (): Promise<Blob | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();

      // Wait a frame for the camera to stabilize
      await new Promise((r) => setTimeout(r, 500));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);

      stream.getTracks().forEach((t) => t.stop());

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setPhotoUrl(url);
          }
          resolve(blob);
        }, 'image/jpeg', 0.8);
      });
    } catch (err) {
      console.error('Failed to capture photo:', err);
      return null;
    }
  }, []);

  const saveSession = useCallback(async (productId: string, clientName: string) => {
    const session: RecordingSession = {
      id: Date.now().toString(),
      audioBlob: audioBlobRef.current,
      photoBlob: null,
      photoUrl,
      timestamp: new Date(),
      productId,
      clientName,
    };
    await saveRecording(session);
    return session;
  }, [photoUrl]);

  const resetMedia = useCallback(() => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    audioBlobRef.current = null;
    chunksRef.current = [];
  }, [photoUrl]);

  return {
    isRecording,
    photoUrl,
    startRecording,
    stopRecording,
    capturePhoto,
    saveSession,
    resetMedia,
  };
};
