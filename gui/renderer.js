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
var graphData = [];
var graph;
var readingInterval = 1;
var readingIntervalCount = 0;

// wrap initHantekMessage in function call
function startHantek(mode = '', relative = false){
    ipcRenderer.send('initHantekMessage', {
      mode: mode,
      relative: relative,
    });
}

// assign events to all of the range buttons
Array.from(document.getElementsByClassName("rangeButton")).forEach(function(arrayElement){
   arrayElement.addEventListener('click', () => {
       startHantek(arrayElement.getAttribute('data-rangeValue'));
   });
});

// assign an event to the rel button
document.getElementById("btnRel").addEventListener('click',()=>{
    startHantek("", true);
});

// assign an event to the stop button
document.getElementById("btnStop").addEventListener('click',()=>{
    ipcRenderer.send('stopHantekMessage');
});

// assign an event to the clear button
document.getElementById("btnClear").addEventListener('click',()=>{
    graphData = [];
    graph.updateOptions( { 'file': graphData } );
    var tableBody = document.getElementById("bodyTableReadings");
    tableBody.innerHTML = "";
});

// assign events to all of the interval links
Array.from(document.getElementsByClassName("intervalSelector")).forEach(function(arrayElement){
   arrayElement.addEventListener('click', () => {
       readingInterval = arrayElement.getAttribute('data-value');
       console.log("Recording interval is " + readingInterval);
   });
});

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
        readingString = readingString.replace(/[\+#\n]+/g, "");
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

        //work out what range the datalogger is operating in
        range = readingElements[0].replace("-", "");
        range = range.replace(/[0-9\?:]/g, "0");
        range = range.replace("0", "6");
        range = range+readingElements[1];
        if(range == "6000VDC")
        {
            range="800VDC";
        }


        var displayElement = document.getElementById("dmmDisplay");
        if (readingElements[0].startsWith('?'))
        {
            displayElement.textContent = "Out of Range (" + readingElements[1] + ")";
        }else{
            displayElement.textContent = readingElements[0] + " " + readingElements[1];
        }

        var rangeElement = document.getElementById("rangeDisplay");
        rangeElement.innerHTML = '<span style="color:gray;">RANGE:</span>&nbsp;&nbsp;&nbsp;' + readingElements[2] + '&nbsp;&nbsp;&nbsp;' + range;

        // show the manual range selection button groups based on the current reading units
        Array.from(document.getElementsByClassName("rangeButtonGroup")).forEach(function(arrayElement){
            if (readingElements[1].endsWith(arrayElement.getAttribute('data-showSuffix')))
            {
                arrayElement.classList.remove("hidden");
            }else{
                arrayElement.classList.add("hidden");
            }
        });

        // select Manual and Auto buttons based on AUTO and range.
        if (readingElements[2] == "AUTO")
        {
            ["autoButton", "majorModeButton"].forEach(function(classSelector){
                Array.from(document.getElementsByClassName(classSelector)).forEach(function(arrayElement){
                    if (readingUnit.endsWith(arrayElement.getAttribute('data-activeUnits'))){
                        arrayElement.classList.add("active");
                    } else {
                        arrayElement.classList.remove("active");
                    }
                });
            });

            // the Auto mA buttons need additional handling to deactivate the A button
            if(readingUnit == "mAAC" || readingUnit == "mADC"){
                document.getElementById('btnAmpsAc').classList.remove('active');
                document.getElementById('btnAmpsDc').classList.remove('active');
            }


            Array.from(document.getElementsByClassName("manuButton")).forEach(function(arrayElement){
                arrayElement.classList.remove("active");
            });

        }else{
            ["autoButton", "majorModeButton"].forEach(function(classSelector){
                Array.from(document.getElementsByClassName(classSelector)).forEach(function(arrayElement){
                    arrayElement.classList.remove("active");
                });
            });

            Array.from(document.getElementsByClassName("manuButton")).forEach(function(arrayElement){
                if (range == arrayElement.getAttribute('data-activeRange'))
                {
                    arrayElement.classList.add("active");
                }else{
                    arrayElement.classList.remove("active");
                }
            });
        }

        // highlight the rel function based on whether there is a REL element at the 
        // end of the packet
        if ((readingElements.length == 4) && (readingElements[3] == "REL")){
            document.getElementById("btnRel").classList.add('active');
        }else{
            document.getElementById("btnRel").classList.remove('active');
        }






    } else {
        console.log("Hantek Info: " + readingString)
    }
});

ipcRenderer.on('errorMessage', (event, props) => {
    var errorString = new TextDecoder("utf-8").decode(props.data);
    console.log("Hantek Error: " + errorString)
});

ipcRenderer.on('statusMessage', (event, props) => {
    console.log("Hantek Status: " + props.data)
});

ipcRenderer.on('saveDataMessage', (event, props) => {
    var tableBody = document.getElementById("bodyTableReadings");
    var dataToSave = "date,value,unit\n";
    for (var i = 0, row; row = tableBody.rows[i]; i++) {
        //iterate through rows
        //rows would be accessed using the "row" variable assigned in the for loop
        dataToSave += row.cells[0].textContent + "," + 
            row.cells[1].textContent + "," + 
            row.cells[2].textContent + "\n";
    }
    console.log(dataToSave);
    ipcRenderer.send('saveDataResponse', dataToSave);
});

window.onload = function() {

    graph = new Dygraph(document.getElementById("div_g"), graphData,
            {
                drawPoints: false,
                showRoller: false,
                valueRange: null,
                labels: ['Time', 'Value']
            });
    // It sucks that these things aren't objects, and we need to store state in window.
    window.intervalId = setInterval(function() {

        var runButton = document.getElementById("btnRun");
        var stopButton = document.getElementById("btnStop");

        readingIntervalCount++;
        if (readingIntervalCount >= readingInterval)
        {
            readingIntervalCount = 0;

            if (readingCount){

                stopButton.classList.remove('active');
                runButton.classList.add('active');


                var x = new Date();  // current time
                var y = readingTotal / readingCount;
                readingTotal = 0.0;
                readingCount = 0;

                var tableBody = document.getElementById("bodyTableReadings");
                var row = tableBody.insertRow(-1);

                var dateTime = row.insertCell(0);
                var value = row.insertCell(1);
                var unit = row.insertCell(2);

                // Add some text to the new cells:
                dateTime.innerHTML = x.toISOString();
                value.innerHTML = y.toFixed(3);
                unit.innerHTML = readingUnit;

                graphData.push([x, y]);
                graph.updateOptions( { 'file': graphData } );
            }else{
                runButton.classList.remove('active');
                stopButton.classList.add('active');
            }
        }

    }, 1000);

    // initialise the semantic dropdown controls.
    $('.ui.dropdown').dropdown();
};
