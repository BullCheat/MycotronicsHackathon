firebase.initializeApp({
    apiKey: "AIzaSyB7OiULORWPwNG_BCJCHkZ0WLd_fLmqEqA",
    databaseURL: "https://hackathon-4d0b7.firebaseio.com/",
    projectId: "hackathon-4d0b7",
    storageBucket: "hackathon-4d0b7.appspot.com",
    authDomain: "hackathon-4d0b7.firebaseapp.com",
});

firebase.auth().onAuthStateChanged((user) => {
    if (user)
        loadData();
    else
        firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).then(loadData);

});

//
// UTILS
//

// Formats data to be shown on sliders hover
function adderFixed(a, p) {
    return {formatter: (b) => b.toFixed(p) + a}
}

let dataRes;
let dataKey;
let chart;
let chartData;

// Refreshes shown data from database results
async function refreshData(data, last, key) {
    data = data.val();
    if (key) {
        dataKey = key;
        dataRes = data;
    } else {
        if (last) {
            dataKey = Object.keys(data)[last];
            dataRes = Object.values(data)[last];
            last = dataKey && dataRes;
        }
        if (!last) {
            dataKey = Object.keys(data)[0];
            dataRes = Object.values(data)[0];
        }
    }
    let dateStr = new Date(dataRes.timestamp).toDatetimeLocal();
    $("#timeInput").val(dateStr);
    $("#temperature").text(dataRes.temperature + "°C");
    $("#humidity").text(dataRes.humidity + "%");
    let results;
    try {
        let promises = Array.from(Array(dataRes.pics), (_, i) =>
            firebase.storage().ref().child(dataKey + "_" + i + ".jpg").getDownloadURL()
        );
        results = await Promise.all(promises);
    } finally {
        $("#pictures").html("");
    }
    results.forEach((url) => {
        $("#pictures").append('<div class="col-lg-4" style="padding: 10px 10px 0 0"><img class="border border-dark" width="100%" src="' + url + '"/></div>');
    });
}

let POINT_SIZE = 3;
function refreshGraph() {
    chart = new Chart(document.getElementById("chart").getContext('2d'), {
        type: "line",
        data: {
            datasets: [{
                label: 'Temperature',
                pointRadius: POINT_SIZE,
                pointHitRadius: POINT_SIZE,
                pointHoverRadius: 2*POINT_SIZE,
                data: Object.values(chartData).map((v) => {
                    return {x: Math.floor(v.timestamp/1000)*1000, y: v.temperature}
                }),
                fill: false,
                borderColor: 'rgba(255,0,0,1)',
                pointBackgroundColor: 'rgba(255,0,0,1)',
                borderWidth: 1,
                cubicInterpolationMode: "monotone",
                yAxisID: 'temperature',
            },
            {
                label: 'Humidity',
                pointRadius: POINT_SIZE,
                pointHitRadius: POINT_SIZE,
                pointHoverRadius: 3*POINT_SIZE,
                data: Object.values(chartData).map((v) => {
                    return {x: Math.floor(v.timestamp/1000)*1000, y: v.humidity}
                }),
                fill: false,
                borderColor: 'rgba(0, 0, 255, 1)',
                pointBackgroundColor: 'rgba(0, 0, 255, 1)',
                borderWidth: 1,
                cubicInterpolationMode: "monotone",
                yAxisID: 'humidity',
            }]
        },
        options: {
            showLines: false,
            scales: {
                xAxes: [{
                    type: 'time',
                }],
                yAxes: [{
                    id: 'temperature',
                    position: 'left',
                    scaleLabel: {
                        display: true,
                        labelString: 'Temperature'
                    },
                },
                {
                    id: 'humidity',
                    scaleLabel: {
                        display: true,
                        labelString: 'Humidity'
                    },
                    position: 'right',
                    ticks: {
                        min: 0,
                        max: 100
                    }
                }]
            }
        }
    })
}

function loadData() {
    firebase.database().ref("/settings/adrean/1/").once("value").then((settings) => {
        let s = settings.val();
        $("#temperatureSlider").slider("setValue", s.temperature);
        $("#cutoffTemperatureSlider").slider("setValue", s.cutoff);
        $("#intervalSlider").slider("setValue", s.interval);
    });
    firebase.database().ref("/logs/")
        .orderByChild("timestamp")
        .limitToLast(1)
        .once("value")
        .then(refreshData);
    firebase.database().ref("/logs/")
        .orderByChild("timestamp")
        .startAt(new Date().getTime() - 86400000)
        .once("value")
        .then((d) => {
            chartData = d.val();
            refreshGraph();
        });
}

//
// TRIGGERS
//

$("#prevButton").click(() => {
    firebase.database().ref("/logs/").orderByChild("timestamp").endAt(dataRes.timestamp).limitToLast(2).once("value").then(refreshData)
});
$("#nextButton").click(() => {
    firebase.database().ref("/logs/").orderByChild("timestamp").startAt(dataRes.timestamp).limitToFirst(2).once("value").then((value) => {
        refreshData(value, 1)
    })
});

function jumpto() {
    let end = new Date($("#timeInput").val()).getTime() + 999;
    firebase.database().ref("/logs/").orderByChild("timestamp").endAt(end).limitToLast(1).once("value").then(refreshData);
}
function jumpToSpecific(id) {
    console.log(id);
    firebase.database().ref("/logs/").child(id).once("value").then((data) => refreshData(data, false, id));
}

//
// SLIDERS
//

$("#temperatureSlider").slider(adderFixed('°C', 1)).on('change', (event) => {
    firebase.database().ref("/settings/adrean/1").update({temperature: event.value.newValue})
});
$("#cutoffTemperatureSlider").slider(adderFixed('°C', 1)).on('change', (event) => {
    firebase.database().ref("/settings/adrean/1").update({cutoff: event.value.newValue})
});
$("#intervalSlider").slider(adderFixed('s', 0)).on('change', (event) => {
    firebase.database().ref("/settings/adrean/1").update({interval: event.value.newValue})
});
$("#chart").click((event) => {
    let res = chart.getElementAtEvent(event);
    if (res[0])
        jumpToSpecific(Object.keys(chartData)[res[0]._index])
});

Date.prototype.toDatetimeLocal =
    function toDatetimeLocal(readable) {
        var
            date = this,
            ten = function (i) {
                return (i < 10 ? '0' : '') + i;
            },
            YYYY = date.getFullYear(),
            MM = ten(date.getMonth() + 1),
            DD = ten(date.getDate()),
            HH = ten(date.getHours()),
            II = ten(date.getMinutes()),
            SS = ten(date.getSeconds())
        ;
        return YYYY + '-' + MM + '-' + DD + (readable ? ' ': 'T') +
            HH + ':' + II + ':' + SS;
    };