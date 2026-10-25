const host = window.location.hostname;
const currentPort = window.location.port;
const websocketPort = currentPort ? Number.parseInt(currentPort, 10) + 1 : 3001;
const websocket = new WebSocket(`ws://${host}:${websocketPort}`);

websocket.onclose = () => {
    setTimeout(() => window.location.reload(), 2000);
};