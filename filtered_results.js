var streamContainer;
var websocket;
var streamData = [];
var roomSpecificOnly = false;

var memoryMax = 10000;
var pageMax = 500;
var roomOnlyFilter = false;

const filterOptions = {
    floor: {
        path: 'metadata.buildingFloor',
        match: 'exact'
    },
    room: {
        path: 'metadata.roomNumber',
        match: 'any'
    },
    zone: {
        path: 'metadata.roomZone',
        match: 'any'
    }
};
var selectedFilters = { floor: null, room: null, zone: null };

function startStream() {
    websocket = new WebSocket('wss://api.usb.urbanobservatory.ac.uk/stream');
    websocket.addEventListener('message', function (m) {
        streamData = streamData.concat(m.data).slice(0, memoryMax);
        filter(m.data);

    });
}

function addFilter(filterType, value) {
    selectedFilters[filterType] = value;
}

function removeFilter(filterType, value) {
    selectedFilters[filterType] = null;
}

function clearFilters() {
    selectedFilters = { floor: null, room: null, zone: null };
}

function filter(messageData) {
    var message = JSON.parse(messageData).data;
    var addMessage = true;
    var metadata = {};
    Object.assign(metadata, message.brokerage.broker.meta);
    Object.assign(metadata, message.brokerage.meta);
    Object.assign(metadata, message.entity.meta);
    Object.assign(metadata, message.feed.meta);
    message.metadata = metadata;
    for (var i in selectedFilters) {
        var filteredValue = findValue(message, filterOptions[i].path);
        switch (filterOptions[i].match) {
            case 'any':
                if (selectedFilters[i] != null && filteredValue.indexOf(selectedFilters[i].trim()) < 0)
                    addMessage = false;
                break;
            case 'exact':
                if (selectedFilters[i] != null && filteredValue.trim() != selectedFilters[i].trim())
                    addMessage = false;
                break;
            default:
                if (selectedFilters[i] != null && filteredValue.indexOf(selectedFilters[i].trim()) < 0)
                    addMessage = false;
                break;
        }
    }



    if (addMessage) //return message;
    {
        var units = (message.timeseries || {}).unit || '';
        if (units === 'no units' || units === 'unknown') {
            units = undefined;
        }

        var location = metadata.roomNumber ? ('Room ' + metadata.roomNumber) : '';
        if (metadata.roomNumber && metadata.roomZone) {
            location += ' Zone ' + metadata.roomZone;
        }
        if (!location && metadata.buildingFloor) {
            location += 'Floor ' + metadata.buildingFloor;
        }
        if (!location && metadata.plantRoom) {
            location += ' Plant Room ' + metadata.plantRoom;
        }
        if (location && metadata.roomDescription) {
            location += ' (' + metadata.roomDescription + ')';
        }
        var variable = message.feed.metric || message.brokerage.id;
        if (!location && message.feed.metric && message.brokerage.id) {
            variable += ' (' + message.brokerage.id + ')';
        }
        if (message.timeseries.value.data !== undefined && (!roomOnlyFilter || metadata.roomNumber)) {

            addStream(
                message.timeseries.value.time,
                (variable || '').replace(/CO2/g, 'CO<sub>2</sub>'),
                location,
                parseFloat(message.timeseries.value.data.toPrecision(3)),
                units,
                message.brokerage.id,
                message.entity.name ? message.entity.name : ''
            );
        }
    }
};

function findValue(message, path) {
    var p = path.split('.');
    var value = message;
    for (var i of p) {
        if (value[i] != undefined) value = value[i];
        else return '';
    }

    return value;
}

function addStream(timestamp, variable, location, value, units, name, buildingName) {
    if (!streamContainer || !variable) return;
    var listElement = document.createElement('li');
    var variableMain = ((variable.match(/^[^\(]+/) || [])[0] || '').trim();
    variable = variableMain ?
        '<span class="variable"><a title="' + name + '">' + variableMain + '</a></span>' + variable.replace(variableMain, '') :
        '<span class="variable"><a title="' + name + '">' + variable + '</a></span>';
    var locationString = variable && location ? (variable + ' in <strong><a title="' + buildingName + '">' + location + '</a></strong>') : variable;
    listElement.innerHTML = '\
      <span class="timestamp">' + timestamp + '</span> \
      <span class="description">' + locationString + ' is now <span class="number">' + value + '</span>' + (units ? ' ' + units : '') + '.</span>\
    ';
    streamContainer.insertBefore(listElement, streamContainer.firstElementChild);
    //removeExcessChildren(streamContainer, pageMax);
}

function removeExcessChildren(target, maximumChildren) {
    if (target.children.length <= maximumChildren) return;
    while (target.children.length > maximumChildren) {
        target.removeChild(target.children[target.children.length - 1]);
    }
}

function applyFilters() {
    addFilter('floor', $('#floor-filter').val() && $('#floor-filter').val() != '' ? $('#floor-filter').val() : null);
    addFilter('room', $('#room-filter').val() && $('#room-filter').val() != '' ? $('#room-filter').val() : null);
    addFilter('zone', $('#zone-filter').val() && $('#zone-filter').val() != '' ? $('#zone-filter').val() : null);

    var filterMessage = [];
    if (selectedFilters.room) filterMessage.push("Room: " + selectedFilters.room);
    if (selectedFilters.floor) filterMessage.push("Floor: " + selectedFilters.floor);
    if (selectedFilters.zone) filterMessage.push("Zone: " + selectedFilters.zone);

    roomOnlyFilter = $('#room-only').is(':checked');

    var showFilterMessage = filterMessage.length > 0 ? "Filtering for " + filterMessage.join(' | ') : "";
    $('#filter-message').text(showFilterMessage);
}

function clearData(){
    $('#stream-container').html('');
}

$(document).ready(function () {
    streamContainer = document.getElementById('stream-container');
    startStream();
});

