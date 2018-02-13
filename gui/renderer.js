// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.


var Dygraph = require('dygraphs');
const { ipcRenderer, remote } = require('electron');

// keep readings global so that
// we can access them in timer based routines.
var readingTotal = 0.0;
var readingCount = 0;
var readingUnit = "";

// wrap initHantekMessage in function call
function startHantek(mode = '', relative = false){
    ipcRenderer.send('initHantekMessage', {
      mode: mode,
      relative: relative,
    });
}

// assign events to all of the range buttons
Array.from(document.getElementsByClassName("rangeButton")).forEach(function(arrayElement){
   arrayElement.addEventListener('click', () => {startHantek(arrayElement.getAttribute('data-rangeValue'));});
});

/*
document.querySelector('#btnStartHantek').addEventListener('click', () => { startHantek() });
document.querySelector('#btnVoltsDc').addEventListener('click', () => { startHantek('vdc') });
document.querySelector('#btnVoltsAc').addEventListener('click', () => { startHantek('vac') });
document.querySelector('#btnAmpsDc').addEventListener('click', () => { startHantek('adc') });
document.querySelector('#btnAmpsAc').addEventListener('click', () => { startHantek('aac') });
document.querySelector('#btnOhm').addEventListener('click', () => { startHantek('ohm') });
document.querySelector('#btnDiode').addEventListener('click', () => { startHantek('diode') });
document.querySelector('#btnConti').addEventListener('click', () => { startHantek('conti') });
document.querySelector('#btnCap').addEventListener('click', () => { startHantek('cap') });
document.querySelector('#btnTemp').addEventListener('click', () => { startHantek('temp') });
*/

// IPC
ipcRenderer.on('readingMessage', (event, props) => {
    //console.log({event, props});
    var readingString = new TextDecoder("utf-8").decode(props.data);
    // this is not technically correct.  It relies on the fact that the
    // hantek command line utility flushes after every reading, so 99.9%
    // of the time we will receive a complete reading packet in this event.
    // FIXME: It realy should be cached, assuming a stream that may contain parts
    // of a packet.

    if (readingString.startsWith("#") && readingString.endsWith("\n"))
    {
        // this is a reading packet.
        // strip the newline, the hash and the leading + if it exists.
        readingString = readingString.replace(/[\+#\n]+/, "");
        var readingElements = readingString.split(" ");
        var readingValue = parseFloat(readingElements[0]);

        if (readingUnit != readingElements[1])
        {
            readingTotal = readingValue;
            readingCount = 1;
            readingUnit = readingElements[1];
        }else {
            readingTotal += readingValue;
            readingCount++;
        }

        readingTotal += readingValue;
        readingCount++;

        var displayElement = document.getElementById("dmmDisplay");
        if (readingElements[0].startsWith('?'))
        {
            displayElement.textContent = "Out of Range (" + readingElements[1] + ")";
        }else{
            displayElement.textContent = readingElements[0] + " " + readingElements[1];
        }
    } else {
        var pre = document.getElementById('preStatus');
        var div = document.getElementById('divStatus');
        pre.innerHTML += readingString;
        div.scrollTop = div.scrollHeight;
    }
});

ipcRenderer.on('errorMessage', (event, props) => {
    //console.log({event, props});
    var errorString = new TextDecoder("utf-8").decode(props.data);
    var pre = document.getElementById('preStatus');
    var div = document.getElementById('divStatus');
    pre.innerHTML += '<span style="color:red;">' + errorString + '</span>';
    div.scrollTop = div.scrollHeight;
});

ipcRenderer.on('statusMessage', (event, props) => {
    //console.log({event, props});
    var pre = document.getElementById('preStatus');
    var div = document.getElementById('divStatus');
    pre.innerHTML += '<span style="color:blue;">' + props.data + '</span>';
    div.scrollTop = div.scrollHeight;
});

window.onload = function() {
      var data = [];
      /*
      var t = new Date();
      for (var i = 10; i >= 0; i--) {
        var x = new Date(t.getTime() - i * 1000);
        data.push([x, Math.random()]);
      }
      */

      var g = new Dygraph(document.getElementById("div_g"), data,
                          {
                            drawPoints: true,
                            //showRoller: true,
                            //valueRange: [0.0, 1.2],
                            labels: ['Time', 'Value']
                          });
      // It sucks that these things aren't objects, and we need to store state in window.
      window.intervalId = setInterval(function() {
        var x = new Date();  // current time
        var y = readingTotal / readingCount;
        readingTotal = 0.0;
        readingCount = 0;

        var table = document.getElementById("tableReadings");
        var row = table.insertRow(-1);

        var dateTime = row.insertCell(0);
        var value = row.insertCell(1);
        var unit = row.insertCell(2);

        // Add some text to the new cells:
        dateTime.innerHTML = x.toISOString();
        value.innerHTML = y.toFixed(3);
        unit.innerHTML = readingUnit;

        data.push([x, y]);
        g.updateOptions( { 'file': data } );
        //g.resize();
      }, 1000);
    };
