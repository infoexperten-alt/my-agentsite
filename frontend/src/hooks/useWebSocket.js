import { useEffect, useRef, useCallback, useState } from "react";

export default function useWebSocket(projectId) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const listenersRef = useRef({});

  const on = useCallback((event, cb) => {
    if (!listenersRef.current[event]) listenersRef.current[event] = [];
    listenersRef.current[event].push(cb);
    return () => {
      listenersRef.current[event] = listenersRef.current[event].filter(
        (fn) => fn !== cb
      );
    };
  }, []);

  const connect = useCallback(() => {
    if (!projectId) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/generate/${projectId}`;
    const ws = new WebSocket(url);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        (listenersRef.current[data.type] || []).forEach((cb) => cb(data));
        (listenersRef.current["message"] || []).forEach((cb) => cb(data));
      } catch {}
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => {};

    wsRef.current = ws;
  }, [projectId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { connected, lastMessage, connect, disconnect, send, on };
}
