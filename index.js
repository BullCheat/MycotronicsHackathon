const express = require('express');
const app = express();
const http = require("http").Server(app);
const init = require('raspi').init;
const Serial = require('raspi-serial').Serial;
const fs = require("fs");

const io = require('socket.io')(http);

let controls = {};

app.use(express.static('app'));

io.on('connection', (socket) => {
    updateSensors(socket);
    updateControls(socket);
    updateTimeline(socket);
    updateCurrentPicture(socket);
    socket.on('udateSensors', () => updateSensors(socket));
    socket.on('updateControls', () => updateControls(socket));
    socket.on('updateTimeline', () => updateTimeline(socket));
    socket.on('updateCurrentPicture', () => updateCurrentPicture(socket));
    socket.on('saveCurrentPicture', saveCurrentPicture);
    socket.on('setControls', (c) => {
        controls = Object.assign(controls, c);
        updateControls(io);
        uploadControls(c);
    });
});

function saveCurrentPicture() {
    fs.copyFile("app/pictures/latest.jpg", "app/pictures/timeline/" + Date.now() + ".jpg", (err) => {
        if (err) console.log(err);
        else updateCurrentPicture(io)
    })
}

function updateCurrentPicture(socket) {
    require('child_process').spawn('fswebcam', ["app/pictures/latest.jpg", "-r", "1200x900"]).on('close', (code) => {
        if (code !== 0) console.log("fswebcam exited with error code", code);
        else socket.emit("refreshPicture")
    })
}

function updateTimeline(socket) {
    fs.readdir("app/pictures/timeline", (err, files) => {
        if (err) console.log(err);
        else {
            files.sort((a, b) => b - a);
            socket.emit(files.slice(-5).map((f) => "app/pictures/timeline/" + f));
        }
    })
}

var sensors = {};

function updateSensors(socket) {
    socket.emit('sensors', sensors)
}

function updateControls(socket) {
    socket.emit("controls", controls)
}

var mappings = {
    temperature: "t",
    humidity: "h"
};

var mappingsReversed = Object.keys(mappings)
    .reduce((obj, key) => Object.assign({}, obj, {[mappings[key]]: key}), {});
var arduino;
function uploadControls(c) {
    if (arduino === undefined) {
        console.log("nope");
        return;
    }
    arduino.write('t');
    var b = new Buffer(2);
    console.log((c.temperature*10) << 0);
    b.writeUInt16BE((c.temperature*10) << 0, 0);
    arduino.write(b);
}
init(() => {
    arduino = new Serial({baudRate: 9600});
    arduino.open(() => {
        arduino.on('data', (data) => {
            sensors = Object.assign(sensors, {temperature: String(data).trim()});
            updateSensors(io)
        });
    });
});

setInterval(() => updateSensors(io), 1000);

http.listen(8080);