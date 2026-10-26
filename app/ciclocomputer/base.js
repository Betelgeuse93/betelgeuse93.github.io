//parte base
function segnalaErrore(msg) {
    if (window.AppInventor) {
        window.AppInventor.setWebViewString(JSON.stringify({"ordine":"errore","msg":String(msg)}));
    }
}

window.addEventListener("error", (e) => {
    segnalaErrore(e.message + " @" + e.lineno);
});

window.addEventListener("unhandledrejection", (e) => {
    segnalaErrore((e.reason && e.reason.message) || e.reason);
});
let main_content = document.getElementsByTagName("main")[0];
let appInventor = false;
let dbVersion = 1.2;

//controllo tipo applicazione ed inizializzazione database in sua assenza
if (window.AppInventor) {
    appInventor = true;
    
} else {
    //main_content.removeChild(gps_btn);
    console.log("esecuzione fuori app inventor");
    if (!window.localStorage.getItem("ODO")) {
        console.log("Generazione database nel localStorage...");
        window.localStorage.setItem("dbVersion",1.2);
        window.localStorage.setItem("ODO",JSON.stringify([{"km":0,"diff":0,"time":0}]));
        window.localStorage.setItem("ultima-finestra",1);
        window.localStorage.setItem("tema",0);
    } 
    if (window.localStorage.getItem("dbVersion") < dbVersion) {
        migrazioneDb(dbVersion,window.localStorage.getItem("dbVersion"));
    }
}

function migrazioneDb (versioneDestinazione, versionePartenza) {
    if (versionePartenza < 1.1) {
        window.localStorage.setItem("ultima-finestra",1);
        window.localStorage.setItem("dbVersion",1.1);
    } 
    if (versionePartenza < 1.2) {
        window.localStorage.setItem("tema",0);
        window.localStorage.setItem("dbVersion",1.2);
    }
}

//funzione di salvataggio nel database

function salva (payload){
    if (appInventor) {
        window.AppInventor.setWebViewString(JSON.stringify({"ordine":"salva","km":payload.km,"diff":payload.diff,"time":payload.time,"id":payload.id}));
    }
    else {
        let storico = JSON.parse(window.localStorage.getItem("ODO"));
        storico.push(payload);
        window.localStorage.setItem("ODO",JSON.stringify(storico));
    }
}



//modificare questa funzione in modo tale che faccia il return della lista e che possa essere 
//chiamata da qualsiasi funzione che deve accedere alla lista delle uscite
async function recupera_uscite() {
    let out;
    if (appInventor) {
        window.AppInventor.setWebViewString(JSON.stringify({"ordine":"lista_uscite"}));
        out = JSON.parse(await attendiWebString());
    } else {
        out = window.localStorage.getItem("ODO");
    }
    return out;
}


function tempoAttuale() {
    return Date.now() / 1000 | 0;
}
function attendiWebString() {
    return new Promise((resolve, reject) => {
        const inizio = Date.now();
        const intervallo = setInterval(() => {
            const risposta = window.AppInventor.getWebViewString();
            if (risposta) {
                clearInterval(intervallo);
                resolve(risposta);
            } else if (Date.now() - inizio > 2500) {
                clearInterval(intervallo);
                window.AppInventor.setWebViewString(JSON.stringify({"ordine":"allerta","contenuto":"Errore, il frontend non riceve la stringa da AppInventor"}));
                reject(new Error("Timeout: nessuna risposta da AppInventor"));
                
            }
        }, 100);
    });
}
async function ottieniUltimoChilometraggio() {
    if (appInventor) {
        window.AppInventor.setWebViewString(JSON.stringify({"ordine":"ottieni_ultimi_km"}));
        let out = JSON.parse(await attendiWebString());
        return out.at(-1);
    }
    else {
        let out = JSON.parse(window.localStorage.getItem("ODO"));
        return out.at(-1);
    }
}

// Converte l'indice del mese (0-11, come restituito da getMonth()) nel nome
// del mese in italiano.
function mese(numeroArray) {
    nomeMese = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio",
                "agosto","settembre","ottobre","novembre","dicembre"];
    return nomeMese[numeroArray];
}

function idCasuale() {
    return Math.random().toString(36).substring(4,14);
}




async function elimina_valore(id) {
    if (appInventor){
        window.AppInventor.setWebViewString(JSON.stringify({"ordine":"cancella_tratta","id_tratta":id}));
    }else {
    let dati = JSON.parse(await recupera_uscite());

	//per trovare l'indice del valore da eliminare ed il successivo da aggiornare bisogna necessariamente scorrere l'array, trovare l'ìindice dove si trova la corrispondenza, e poi eliminare dall'array quell'indice e modificare l'indice successivo.
    let pos_valore = dati.findIndex(valore => valore.id == id);
    
    if (dati.length != pos_valore+1) {
        let km_prec = dati[pos_valore-1].km;
        let km_succ = dati[pos_valore+1].km;
        let diff = km_succ - km_prec;
        dati[pos_valore+1].diff=diff;
    }
    dati.splice(pos_valore,1);
    window.localStorage.setItem("ODO",JSON.stringify(dati));
    avvio();
    }
       
}

async function avvio() {
    let uscite = await recupera_uscite();
    renderizzaLista(uscite);
}

// rendering lista appInventor e webapp
function renderizzaLista(lista_stringa) {
    let contenitore_principale = document.getElementById("lista");
    contenitore_principale.innerHTML = "";
    let elenco_uscite = JSON.parse(lista_stringa);
    let elemento_lista = document.createElement("ul");
    elenco_uscite.reverse().forEach(uscita => {
        if (uscita.time != 0) {
            let riga = document.createElement("li");
            let chilometri = document.createElement("div");
            let differenza = document.createElement("div");
            let data = document.createElement("div");
            let elimina = document.createElement("button");
            chilometri.innerText = "KM: " + uscita.km + " km";
            differenza.innerText = "Diff: +" + uscita.diff+" km";
            let oggetto_tempo = new Date(uscita.time * 1000);
            let data_formattata =  oggetto_tempo.getDate() + " " + mese(oggetto_tempo.getMonth()) + " " + oggetto_tempo.getFullYear();
            //elimina.value = uscita.id;
            elimina.innerText = "Elimina";
            elimina.addEventListener("click", () => elimina_valore(uscita.id));
            data.innerText = "Data: " + data_formattata;
            riga.appendChild(data);
            riga.appendChild(chilometri);
            riga.appendChild(differenza);
            riga.appendChild(elimina);
            elemento_lista.appendChild(riga);
        }
    });
    contenitore_principale.appendChild(elemento_lista);
}

//formattazione corretta numero
function formattaNumero(input) {
    if (typeof input === "number") return input;
    let testo = String(input).trim();
    if (testo.includes(",")) {
        // formato italiano: 1.234,5
        testo = testo.replace(/\./g, "").replace(",", ".");
    }
    // senza virgola il punto resta decimale: 1.2 -> 1.2
    return Number(testo);
}


let colore = 0; // 0 = auto, 1 = chiaro, 2 = scuro

async function carica_tema() {
    if (appInventor) {
        window.AppInventor.setWebViewString(JSON.stringify({"ordine":"colore_tema"}));
        colore = Number(await attendiWebString()) || 0;
    } else {
        colore = Number(window.localStorage.getItem("tema")) || 0;
    }
    applicaTema();
}

function applicaTema(salva=false) {
    if (colore == 1) {
        document.documentElement.setAttribute("data-theme", "light");
    } else if (colore == 2) {
        document.documentElement.setAttribute("data-theme", "dark");
    } else {
        document.documentElement.removeAttribute("data-theme");
    }
    if (salva) {
        if (appInventor) {
            window.AppInventor.setWebViewString(JSON.stringify({"ordine":"imposta_colore_tema","valore":colore}));
        } else {
            window.localStorage.setItem("tema",colore);
        }
    }

}

carica_tema();




///////////////////////////////////////////////
/// ROUTING                                ///
//////////////////////////////////////////////
let bottone_home = document.getElementById("home-selettore-schermata");
let bottone_impostazioni = document.getElementById("impostazioni-selettore-schermata");
if (!appInventor) {
    let posizione = window.localStorage.getItem("ultima-finestra");
    chiama_pagina(posizione)
}
function chiama_pagina(posizione){
    if (posizione == 1) {
        genera_finestra_home();
    } else if (posizione == 2) {
        genera_finestra_impostazioni();
    }
}
bottone_home.addEventListener("click", genera_finestra_home);
bottone_impostazioni.addEventListener("click", genera_finestra_impostazioni);
//finestra home
function genera_finestra_home() {

    bottone_home.className = "icon active";
    bottone_impostazioni.className = "icon";
    main_content.innerHTML="";
    let contenitore_bottoni = document.createElement("div");
    contenitore_bottoni.id = "bottoni";
    let bottone_segna_uscita = document.createElement("button");
    bottone_segna_uscita.id="segna-uscita-btn";
    bottone_segna_uscita.innerText="Segna uscita";
    let bottone_agg_km = document.createElement("button");
    bottone_agg_km.id="aggiorna-chilometri-btn";
    bottone_agg_km.innerText="Aggiorna i chilometri";
    let contenitore_uscite = document.createElement("div");
    contenitore_uscite.id="lista";
    contenitore_bottoni.appendChild(bottone_segna_uscita);
    contenitore_bottoni.appendChild(bottone_agg_km);
    main_content.appendChild(contenitore_bottoni);
    main_content.appendChild(contenitore_uscite);
    if (appInventor) {
        //window.AppInventor.setWebViewString(JSON.stringify({"ordine":"posizione_finestra","valore":1}));
    } else {
        window.localStorage.setItem("ultima-finestra",1);
    }
    home();
    
}
//finestra impostazioni
function genera_finestra_impostazioni() {
    bottone_home.className = "icon";
    bottone_impostazioni.className = "icon active";
    main_content.innerHTML="";
    let contenitore_bottoni = document.createElement("div");
    contenitore_bottoni.id = "bottoni";
    let esporta_dati_btn = document.createElement("button");
    esporta_dati_btn.id="esporta-dati-btn";
    esporta_dati_btn.innerText="Esporta dati";
    /*let cancella_dati_btn = document.createElement("button");
    cancella_dati_btn.id="cancella-tutti-dati-btn";
    cancella_dati_btn.innerText="Elimina tutto";*/
    contenitore_bottoni.appendChild(esporta_dati_btn);
    //contenitore_bottoni.appendChild(cancella_dati_btn);

    //DEFINIZIONE CONTENITORE TEMA
    let contenitore_tema = document.createElement("div");
    contenitore_tema.setAttribute("style","padding:1rem");
    contenitore_tema.setAttribute("class","flex-colonne");
    //TESTO DEL CONTENITORE
    let testo_contenitore_tema = document.createElement("p");
    testo_contenitore_tema.innerText = "Scegli il tema";
    //FORM PER I RADIO BUTTON
    let form_tema = document.createElement("form");
    //RADIOBUTTON CHIARO
    let chiaro = document.createElement("input");
    chiaro.type = "radio";
    chiaro.id = "chiaro";
    chiaro.setAttribute("name","tema");
    if (colore == 1) {
        chiaro.checked = true;
    }
    //EVENTO AL CLICK
    chiaro.addEventListener("click",function(){
        colore = 1;
        applicaTema(true);
    });
    //ETICHETTA RADIOBUTTON CHIARO
    let chiaro_label = document.createElement("label");
    chiaro_label.setAttribute("for","chiaro");
    chiaro_label.innerText = "Chiaro";
    //RADIOBUTTON SCURO
    let scuro = document.createElement("input");
    scuro.type = "radio";
    scuro.id = "scuro";
    if (colore == 2) {
        scuro.checked= true;
    }
    scuro.setAttribute("name","tema");
    //EVENTO
    scuro.addEventListener("click",function(){
        colore = 2;
        applicaTema(true);
    });
    //ETICHETTA SCURO
    let scuro_label = document.createElement("label");
    scuro_label.setAttribute("for","scuro");
    scuro_label.innerText = "Scuro";
    //CREAZIONE BOTTONE AUTO SE FUORI DA APPINVENTOR
    if (!appInventor) {
        let auto = document.createElement("input");
        auto.type = "radio";
        auto.id = "auto";
        auto.setAttribute("name","tema");
        if (colore == 0) {
            auto.checked= true;
        }
        auto.addEventListener("click",function(){
            colore = 0;
            applicaTema(true);
        });
        let auto_label = document.createElement("label");
        auto_label.setAttribute("for","auto");
        auto_label.innerText = "Auto";
        //AGGANCIO AUTO AL FORM
        form_tema.appendChild(auto_label);
        form_tema.appendChild(auto);
    }
    //AGGANCIO DEI BOTTONI AL FORM
    form_tema.appendChild(chiaro_label);
    form_tema.appendChild(chiaro);
    form_tema.appendChild(scuro_label);
    form_tema.appendChild(scuro);
    contenitore_tema.appendChild(testo_contenitore_tema);
    contenitore_tema.appendChild(form_tema);
    //AGGANCIO ELEMNTI AL MAIN
    main_content.appendChild(contenitore_bottoni);
    main_content.appendChild(contenitore_tema);
    if (appInventor) {
        //window.AppInventor.setWebViewString(JSON.stringify({"ordine":"posizione_finestra","valore":2}));
    } else {
        window.localStorage.setItem("ultima-finestra",2);
    }
    impostazioni();
}

/////////////////////////////////////////////
//     PORZIONE HOME                     ///
////////////////////////////////////////////

function home() {


//bootstrap per webapp
if (!appInventor) {
    avvio();
}


//eventi bottoni inserimento dati

    let uscita_btn = document.getElementById("segna-uscita-btn");
    let aggiorna_km_btn = document.getElementById("aggiorna-chilometri-btn");

    aggiorna_km_btn.addEventListener("click", async function(e){
        let km = formattaNumero(prompt("Inserisci il totale dei chilometri: ","000000"));
        if (typeof(km) === "number" && !Number.isNaN(km)) {
            let promessa_ultimi_chilometri = await ottieniUltimoChilometraggio()
            let ultimi_km = Number(promessa_ultimi_chilometri.km) || 0;
            let differenza = ((km*100) - (ultimi_km*100))/100;
            let data = tempoAttuale();
            let output = {"id":idCasuale(),"km":km,"diff":differenza,"time":data};
            salva(output);
            if (!appInventor) {
                avvio();
            }
        } else {
            window.alert("Inserisci un valore corretto");
        }
    });

    uscita_btn.addEventListener("click", async function(e) {
        let trip = formattaNumero(prompt("Quanti km hai fatto?"));
        if (typeof(trip) === "number" && !Number.isNaN(trip)) {
            let data = tempoAttuale();
            let promessa_ultimi_chilometri = await ottieniUltimoChilometraggio()
            let ultimi_km = Number(promessa_ultimi_chilometri.km) || 0;
            let nuoviKm = ((ultimi_km*100) + (trip*100))/100;
            let output = {"id":idCasuale(),"km":nuoviKm,"diff":trip,"time":data};
            salva(output);
            if (!appInventor) {
                avvio();
            }
        } else {
            window.alert("Inserisci un valore corretto");
        }
    });
}


/////////////////////////////////////////
///    CODICE IMPOSTAZIONI          ////
////////////////////////////////////////

async function esportaDati() {
        if (appInventor){
            window.AppInventor.setWebViewString(JSON.stringify({"ordine":"esporta_dati"}));
        }else{
            let dati = await recupera_uscite();
            dati = JSON.stringify(dati);
            const blob = new Blob([dati],{type:"application/json"});
            const url = URL.createObjectURL(blob);
            // Create an <a> element
            const a = document.createElement("a");
            a.href = url;
            a.download = "backup.json"; // Filename
        
        // Append to the DOM (required for older browsers)
            document.body.appendChild(a);
        
        // Trigger the download
            a.click();
        
        // Cleanup: Revoke the temporary URL and remove the element
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    }

function impostazioni() {
    let btnExport = document.getElementById("esporta-dati-btn");

    btnExport.addEventListener("click",esportaDati);


    
}