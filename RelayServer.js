// Imports
var net = require("net");
var udp = require('dgram');

// Server creation
var port = 3000;
var server = net.createServer();
var UDPserver = udp.createSocket({type:'udp4',reuseAddr: true});

// Setup Base Server Logic variables
var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
var CLIENTS = new Map();
var HOSTS = new Map();
CLIENT_COUNT = 0;
//#region TCP Server
server.on("connection",function(socket)
{   
    console.log("Player connected: ")
    socket.setKeepAlive(true, 300);
    socket.setEncoding('utf-8')
    socket.setTimeout(600000)

    var client_id = create_id();
    var TCP_connect_success_msg = 
    {
        code:"TCP_RELAY_SUCCESS",
        client_id:client_id

    }
    send_packet(socket,TCP_connect_success_msg)
    CLIENTS[client_id] = 
    {
        socket: socket,
        udpinfo:"",
        client_id: client_id,
        room_code: "",
        player_name: ""

    };
    CLIENT_COUNT++;
    
    var data_stream = "";
    var start_stream = false;
    
    socket.on("data",function(data)
    {   

        var str = data.toString('utf-8')
		// if we have a start header start appending any data
		if (str.indexOf("XSTART") == 0) {
            
			if (start_stream == false) {
			start_stream = true;
			data_stream += str;

			} 
		}
		else if (start_stream == true) {
		data_stream += str;
		}



		// once we have an end header try splitting the data
		if (str.indexOf("XENDX") != -1) 
		{  
			// split data based on start + end headers
			var splits = data_stream.split("XENDX");
			for (var s = 0; s < splits.length; s++) 
			{
                
                var split = splits[s];
				if (split != "") 
				{
					// snip off the end header from string
					var position = split.indexOf("XSTART");
					var plen = split.length-position+1;
					var postcursor = split.replace("XSTART","");
                    
			
					try
					{
                        console.log("Receiving Packet")
                        console.log(postcursor)
						var json = JSON.parse(postcursor)
						received_packet(socket,client_id,json.code,json)
					}
					catch (ex)
					{
                        console.log("JSON Parse Error")
					}
				}

                // keep going if more
                if (splits.length > 0 && splits[splits.length-1] != "") 
                {
                    data_stream = splits[splits.length-1];
                }
                else {
                    //print("You are gay")
                    data_stream = "";
                    start_stream = false;

                }
			}
            
		}



    });

    socket.once("closed",function()
    {

        console.log("Player Disconnected:");
    });

    socket.once("ECONNRESET",function()
    {
        console.log("Player Disconnected");

    });

    socket.on('error', function (err) {
        console.error(err.code);
        if(err.code == "ECONNRESET")
        {
            // DISCONECT CODE
            if(HOSTS[client_id] != undefined)
            {
                var _msg = 
                {
                    code:"DISCONNECT"
                }
                HOSTS[client_id].PLAYERS.forEach(player => send_packet(player.socket,_msg));
                HOSTS[client_id].PLAYERS.forEach(player => player.room_code = "");
                HOSTS[client_id] = undefined;

            }
            else if(CLIENTS[client_id].room_code != "")
            {
                var indexToRemove = HOSTS[CLIENTS[client_id].room_code].PLAYERS.indexOf(CLIENTS[client_id])
                HOSTS[CLIENTS[client_id].room_code].PLAYERS.splice(indexToRemove,1)
                var _msg = 
                {
                    code:"REMOVE_PLAYER",
                    client_id:client_id
                }
                
                
                send_packet(HOSTS[CLIENTS[client_id].room_code].socket,_msg)
                CLIENTS[client_id].room_code = ""
                
                
            }

        }
    });
});

server.listen(port,function()
{
    console.log("The Server has been Started");
});

//#endregion

//#region UDP Server
UDPserver.on('listening',function(){
    var address = server.address();
    var port = address.port;
    console.log('Server is listening at port' + port);
});

UDPserver.on('message',(data,info) => setImmediate(() => {
    var data_stream = "";
    var start_stream = false;
    var str = data.toString('utf-8')
    // if we have a start header start appending any data
    if (str.indexOf("XSTART") == 0) {
        if (start_stream == false) {
        start_stream = true;
        data_stream += str;

        } 
    }
    else if (start_stream == true) {
    data_stream += str;
    }

    // once we have an end header try splitting the data
    if (str.indexOf("XENDX") != -1) 
    {  
        // split data based on start + end headers
        var splits = data_stream.split("XENDX");
        for (var s = 0; s < splits.length; s++) 
        {
            
            var split = splits[s];
            if (split != "") 
            {
                // snip off the end header from string
                var position = split.indexOf("XSTART");
                var plen = split.length-position+1;
                var postcursor = split.replace("XSTART","");
                
        
                try
                {
                    console.log("Receiving Packet")
                    console.log(postcursor)
                    var json = JSON.parse(postcursor)
                    received_packet(info,json.client_id,json.code,json)
                }
                catch (ex)
                {
                    console.log("JSON Parse Error")
                }
            }

            // keep going if more
            if (splits.length > 0 && splits[splits.length-1] != "") 
            {
                data_stream = splits[splits.length-1];
            }
            else {

                data_stream = "";
                start_stream = false;

            }
        }
    }
        

    
}));

UDPserver.on('error',function(error){
    console.log('Error: ' + error);
    server.close();
});

UDPserver.bind(port)
//#endregion UDP Server
function create_id(){
    var id =""
    for (var a = 0; a < 5; a++){
        var random_number = Math.floor((Math.random() * CHARS.length))
        var random_char = CHARS[random_number]
        id+= random_char
    }

    if(CLIENTS[id] != undefined){
        return create_id();

    }
    return id;
    


}

function received_packet(socket,client_id, code, json)
{   
    
    switch(code)
    {
        case "HOST":
            HOSTS[client_id] = { 
                socket: socket, 
                client_id: client_id,
                host_name: json.player_name, 
                status: "New", 
                PLAYERS: []
            }
            send_packet(socket,{
                code:"HOST_SUCCESS",
                room_code:HOSTS[client_id].client_id})
            break;

        case "UDPCONNECT":
            CLIENTS[json.client_id].udpinfo = socket;
            var UDP_connect_success_msg = 
            {
                code:"UDP_RELAY_SUCCESS"
            }
            send_packet_udp(socket,UDP_connect_success_msg)
            break;
        case "JOINHOST":
            if(HOSTS[json.room_code] != undefined)
            {

            
            HOSTS[json.room_code].PLAYERS.push(CLIENTS[client_id])
            CLIENTS[client_id].room_code = json.room_code
            CLIENTS[client_id].player_name = json.player_name
            send_packet(HOSTS[json.room_code].socket,
                { code:"PLAYER_JOINED",
                client_id: client_id,
                player_name: CLIENTS[client_id].player_name});
            send_packet(CLIENTS[client_id].socket,
                {
                    code:"JOIN_SUCCESS",
                    room_code:json.room_code,
                    client_id:client_id
                })
            }
            else
            {
                send_packet(CLIENTS[client_id].socket,
                    {
                        code:"JOIN_FAIL"
                    })
            }
                break;
        case "DISCONNECT":
            // DISCONECT CODE
            console.log("Disconnect")
            if(HOSTS[client_id] != undefined)
            {
                console.log("Disconnect Host")
                var _msg = 
                {
                    code:"DISCONNECT"
                }
                HOSTS[client_id].PLAYERS.forEach(player => send_packet(player.socket,_msg));
                HOSTS[client_id].PLAYERS.forEach(player => player.room_code = "");
                HOSTS[client_id] = undefined;

            }

            if(CLIENTS[client_id].room_code != "")
            {
                console.log("Client")
                var indexToRemove = HOSTS[CLIENTS[client_id].room_code].PLAYERS.indexOf(CLIENTS[client_id])
                HOSTS[CLIENTS[client_id].room_code].PLAYERS.splice(indexToRemove,1)
                var _msg = 
                {
                    code:"REMOVE_PLAYER",
                    client_id:client_id
                }
                send_packet(HOSTS[CLIENTS[client_id].room_code].socket,_msg)
                CLIENTS[client_id].room_code = ""
            }

            
            break;

        case "SYNC":
            switch(json.message_type)
            {
                case "TCP":
                    HOSTS[json.room_code].PLAYERS.forEach(player => send_packet(player.socket,json));
                    break;
                case "UDP":
                    HOSTS[json.room_code].PLAYERS.forEach(player => send_packet_udp(player.udpinfo,json));
                    break;

            }
            break;
           
        case "COMMAND":
            switch(json.message_type)
            {
                case "TCP":
                    send_packet(CLIENTS[json.room_code].socket,json)
                    break;
                case "UDP":
                    send_packet_udp(CLIENTS[json.room_code].udpinfo,json)
                    break;

            }
            break;
            
            

    }
}

//#region Packet sending
function send_packet(socket,json)
{
    var _msg = JSON.stringify(json)
    console.log("Being Sent:")
    console.log(_msg)
    var data = ""
    data += _msg //+ "=::="
	data = "XSTART" + data + "XENDX"
    socket.write(data)

}

function send_packet_udp(socket,json)
{
    var _msg = JSON.stringify(json)
    console.log("Being Sent UDP:")
    console.log(_msg)
    var data = ""
    data += _msg //+ "=::="
	data = "XSTART" + data + "XENDX"
    UDPserver.send(data,socket.port,socket.address, (error) => {
        if (error) {
            console.error(error)
        } 
        else {
        console.log(_msg)}
    })

}
//#endregion
