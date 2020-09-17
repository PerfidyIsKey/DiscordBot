const Discord = require('discord.js');
const client = new Discord.Client();

var MongoClient = require('mongodb').MongoClient;
var url = process.env.MONGO_STRING;

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

let prefix = "+"

function addPrefix(command) {
    return prefix + command
}

function messageHandler(msg){
    let resume = false
    let heads = true
    let content = msg.content
    let win = false

    if (msg.content.startsWith(addPrefix("heads"))) {
        heads = true
        resume = true
        content = content.replace(addPrefix("heads "), "")
    }
    else if (msg.content.startsWith(addPrefix("tails"))) {
        heads = false
        resume = true
        content = content.replace(addPrefix("tails "), "")
    }
    else if (msg.content == addPrefix("credits")) {
        MongoClient.connect(url, function (err, db) {
            if (err) throw err;
            var dbo = db.db("DiscordBots");

            let query = { id: msg.author.id };
            //find

            dbo.collection("DiscordBot1").find(query).toArray(function (err, result) {
                if (err) throw err;
                console.log("information gathered.");
                if (!result || !result[0]) {
                    msg.reply("No data found.")
                } else {
                    msg.reply("You currently have **" + result[0].credits + "** credits.")
                }
                db.close()
            })
        })
        resume = false
    } else if (msg.content == addPrefix("help")) {
        msg.reply(prefix + "heads <credits> / " + prefix + "tails <credits> / " + prefix + "credits")
        resume = false
    }
    else {
        resume = false
    }

    if (resume) {


        let userID = msg.author.id

        let username = msg.author.username

        let userCredits = 0

        const connectionOptions = {
            useNewUrlParser: true,
            autoReconnect: true,
            reconnectTries: Number.MAX_VALUE,
            poolSize: 10,
            reconnectInterval: 1000
        };

        MongoClient.connect(url, connectionOptions, function (err, db) {
            if (err) throw err;
            var dbo = db.db("DiscordBots");

            let query = { id: userID };
            //find
            const dbPromise = new Promise((resolve, reject) => {
                dbo.collection("DiscordBot1").find(query).toArray(function (err, result) {
                    if (err) throw err;
                    console.log("information gathered.");
                    if (!result || !result[0]) {
                        reject()
                    } else {
                        resolve(result)

                    }
                });
            });

            dbPromise.then((result) => {
                userCredits = result[0].credits
                content = Math.round(+content)
                if (+content <= userCredits && +content > 0) {
                    let rn = Math.round(Math.random())
                    if (rn == 0 && heads || rn == 1 && !heads) {
                        win = true
                    }

                    let ht
                    if (heads) {
                        ht = "heads"
                    } else {
                        ht = "tails"
                    }

                    //update
                    var newvalues = {}
                    let credRes = userCredits
                    if (win) {
                        credRes += +content

                        msg.reply('Congratulations!! You chose **' + ht + '** and received **' + content + '** credits!');
                    } else {
                        credRes -= +content

                        msg.reply('Better luck next time! You chose **' + ht + '** and lost **' + content + '** credits!');
                    }

                    newvalues = { $set: { credits: credRes } };

                    dbo.collection("DiscordBot1").updateOne(query, newvalues, function (err, res) {
                        if (err) throw err;
                        console.log("1 document updated");
                        db.close();
                    });
                }
                else {
                    msg.reply("You don't have sufficient credits.");
                }


            });

            dbPromise.catch(() => {
                var myobj = { name: username, id: userID, credits: 200 };
                dbo.collection("DiscordBot1").insertOne(myobj, function (err, res) {
                    if (err) throw err;
                    console.log("1 document inserted.")
                    db.close();
                    messageHandler(msg)
                })
            })
        });
    }

}

client.on('message', msg => {
    messageHandler(msg)
});

let token = process.env.DISCORD_BOT_TOKEN

client.login(token);