var axios = require('axios');
const platformClient = require('purecloud-platform-client-v2');
var nodemailer = require('nodemailer');
const SMTPConnection = require('smtp-connection');
const { promisify } = require('util');
const AWS = require('aws-sdk');
const app = require('./app');
require('dotenv').config();
// Org: HappyCellsa
const clientId = process.env.GENESYS_OAUTH_CLIENTID;
const clientSecret = process.env.GENESYS_OAUTH_CLIENTSECRET;
let usersgenesys = { entities: [] };
let wrapupCodes = [];
let users = new platformClient.UsersApi();

const client = platformClient.ApiClient.instance;
var presence = new platformClient.PresenceApi();
var tokens = new platformClient.TokensApi();
let opts = {
  pageSize: 500,
  expand: ['presence', 'dateLastLogin'],
  pageNumber: 1,
};
// Configura región (debe ser la misma donde tienes habilitado SES)
const ses = new AWS.SES({ region: 'us-east-2' });
const presenceEng = {
  Available: 'Available',
  OnQueue: 'On Queue',
  Busy: 'Busy',
  Break: 'Break',
  Away: 'Away',
  Meal: 'Meal',
  Meeting: 'Meeting',
  Offline: 'Offline',
  Training: 'Training',
  NA: 'N/D',
};
const presenceEsp = {
  Available: 'Disponible',
  OnQueue: 'En cola',
  Busy: 'Ocupado',
  Break: 'Descanso',
  Away: 'Ausente',
  Meal: 'Comida',
  Meeting: 'Reunión',
  Offline: 'Desconectado',
  Training: 'Capacitación',
  NA: 'N/D',
};

const connection = new SMTPConnection({
  host: 'smtp.office365.com', // ej: smtp.tudominio.com
  port: 587, // o 465 para SSL
  secure: false, // true para puerto 465

  tls: {
    rejectUnauthorized: true, // asegúrate de usar certificados válidos
  },
});

exports.handler = async (event, context) => {
  const now = new Date().toISOString();
  console.log(`Lambda ejecutada a las ${now}`);
  let respUsers = await getUsersPresence();

  // Tu lógica aquí (por ejemplo, enviar un correo, llamar una API, etc.)
  await getTotalLicences(respUsers);
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Ejecutado correctamente',
      timestamp: now,
    }),
  };
};
async function getTotalLicences(res) {
  try {
    var usersC = [];
    var exportLicences = [];
    var countAvailable = 0;
    var countOnQueue = 0;
    var countBusy = 0;
    var countOffline = 0;
    var countTraining = 0;
    var countMeal = 0;
    var countBreak = 0;
    var countAway = 0;
    var countMeeting = 0;
    var countRequest = 0;
    var countUsers = 1;
    var presencia = '';
    var licencesSubscription = 0;
    var jsonT = res;
    for (var i = 0; i < jsonT.entities.length; i++) {
      if (jsonT.entities[i].presence.presenceDefinition != null) {
        if (
          jsonT.entities[i].presence.presenceDefinition.systemPresence !==
          presenceEng.Offline
        ) {
          countUsers++;
          presencia = presenceEsp.Offline;
        }
        if (
          jsonT.entities[i].presence.presenceDefinition.systemPresence ===
          presenceEng.Available
        ) {
          countAvailable++;
          presencia = presenceEsp.Available;
        }
        if (
          jsonT.entities[i].presence.presenceDefinition.systemPresence ===
          presenceEng.OnQueue
        ) {
          countOnQueue++;
          presencia = presenceEsp.OnQueue;
        }
        if (
          jsonT.entities[i].presence.presenceDefinition.systemPresence ===
          presenceEng.Busy
        ) {
          countBusy++;
          presencia = presenceEsp.Busy;
        }
        if (
          jsonT.entities[i].presence.presenceDefinition.systemPresence ===
          presenceEng.Training
        ) {
          countTraining++;
          presencia = presenceEsp.Training;
        }
        if (
          jsonT.entities[i].presence.presenceDefinition.systemPresence ===
          presenceEng.Offline
        ) {
          countOffline++;
          presencia = presenceEsp.Offline;
        }
        if (
          jsonT.entities[i].presence.presenceDefinition.systemPresence ===
          presenceEng.Away
        ) {
          countAway++;
          presencia = presenceEsp.Away;
        }
        if (
          jsonT.entities[i].presence.presenceDefinition.systemPresence ===
          presenceEng.Break
        ) {
          countBreak++;
          presencia = presenceEsp.Break;
        }
        if (
          jsonT.entities[i].presence.presenceDefinition.systemPresence ===
          presenceEng.Meal
        ) {
          countMeal++;
          presencia = presenceEsp.Meal;
        }
        if (
          jsonT.entities[i].presence.presenceDefinition.systemPresence ===
          presenceEng.Meeting
        ) {
          countMeeting++;
          presencia = presenceEsp.Meeting;
        }
        usersC.push({
          Usuario: jsonT.entities[i].name,
          Presencia: presencia,
          Estado: jsonT.entities[i].state,
        });
        exportLicences.push({
          Usuario: jsonT.entities[i].name,
          Correo: jsonT.entities[i].email,
          Presencia: presencia,
          Estado: jsonT.entities[i].state,
        });
      } else {
        presencia = presenceEng.NA;
        usersC.push({
          Usuario: jsonT.entities[i].name,
          Presencia: presenceEng.NA,
          Estado: jsonT.entities[i].state,
        });
        exportLicences.push({
          Usuario: jsonT.entities[i].name,
          Correo: jsonT.entities[i].email,
          Presencia: presencia,
          Estado: jsonT.entities[i].state,
        });
      }
    }
    var totalLic =
      countAvailable +
      countOnQueue +
      countTraining +
      countBusy +
      countMeal +
      countMeeting +
      countAway +
      countBreak;
    licencesSubscription = 100; //TODO: eliminar cuando soliciten nuevamente y dejar automatico
    console.log(
      'Se han identificado un total de ' +
        totalLic +
        ' licencias en uso en este momento.',
    );
    var porcentaje = (totalLic / licencesSubscription) * 100;
    var intPorcentaje = Math.round(porcentaje);
    //************ QUITAR LUEGO DE VALIDAR */
    // let dataStr2 = {
    //   totalLic: totalLic,
    //   countAvailable: countAvailable,
    //   countOffline: countOffline,
    //   countOnQueue: countOnQueue,
    //   countBusy: countBusy,
    //   countMeeting: countMeeting,
    //   countTraining: countTraining,
    //   countBreak: countBreak,
    //   countAway: countAway,
    //   countMeal: countMeal,
    //   licenseSubs: licencesSubscription,
    //   arrayLogoutUserWithNames: [],
    // };
    // await sendEmailTest(dataStr2);
    //************ QUITAR LUEGO DE VALIDAR */
    if (intPorcentaje >= 97 && intPorcentaje <= 99) {
      console.log(
        'Estimado usuario/a, se están utilizando un total de :' +
          totalLic +
          ` licencias, si se superan las ${licencesSubscription} y se mantienen un tiempo mayor a 20 minutos se generará el cobro de las licencias adicionales.`,
      );
      //**************** QUITAR CUANDO SE DEFINA EL MAPEO AUTOMATICO ************/
      let dataStr2 = {
        totalLic: totalLic,
        countAvailable: countAvailable,
        countOffline: countOffline,
        countOnQueue: countOnQueue,
        countBusy: countBusy,
        countMeeting: countMeeting,
        countTraining: countTraining,
        countBreak: countBreak,
        countAway: countAway,
        countMeal: countMeal,
        licenseSubs: licencesSubscription,
        arrayLogoutUserWithNames: [],
      };
      //await sendEmailAdmin(dataStr2);
      var respNE = await sendEmail(dataStr2);
      if (respNE.response !== undefined && respNE.response !== null) {
        console.log('se ha enviado el correo.');
      }
      //**************** FIN: QUITAR CUANDO SE DEFINA EL MAPEO AUTOMATICO ************/
    } else {
      if (totalLic > licencesSubscription) {
        jsonT.entities.sort((b, a) => {
          var dateB = new Date(b.dateLastLogin);
          var dateA = new Date(a.dateLastLogin);
          return dateA.getTime() - dateB.getTime();
        });
        const tempTotalLic = totalLic;
        var arrayLogoutUser = [];
        var arrayLogoutUserWithNames = [];
        var contUser = 0;
        for (let index = tempTotalLic; index > licencesSubscription; index--) {
          arrayLogoutUser.push(jsonT.entities[contUser].id);
          arrayLogoutUserWithNames.push({
            id: jsonT.entities[contUser].id,
            name: jsonT.entities[contUser].name,
            email: jsonT.entities[contUser].email,
          });
          contUser++;
        }
        var dataStr = {
          userId: arrayLogoutUser,
        };
        let strT = dataStr;

        try {
          let respLU = await logoutUser(strT);
          if (respLU.response !== undefined && respLU.response !== null) {
            console.log('Usuarios deslogueados', arrayLogoutUser);
            console.log('se procede con la notificación de correo.');
            let dataStr2 = {
              totalLic: totalLic,
              countAvailable: countAvailable,
              countOffline: countOffline,
              countOnQueue: countOnQueue,
              countBusy: countBusy,
              countMeeting: countMeeting,
              countTraining: countTraining,
              countBreak: countBreak,
              countAway: countAway,
              countMeal: countMeal,
              licenseSubs: licencesSubscription,
              arrayLogoutUserWithNames: arrayLogoutUserWithNames,
            };
            var respNE = await sendEmail(dataStr2);
            //await sendEmailAdmin(dataStr2);

            if (respNE?.response !== undefined && respNE?.response !== null) {
              console.log('se ha enviado el correo.');
            } else {
              console.log(
                'se ha presentado un problema en el envío del correo. ' +
                  respNE?.error,
              );
            }
          }
        } catch (error) {
          console.log(error);
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
}
async function logoutUser(users) {
  usersgenesys = { entities: [] };
  try {
    const results = await logoutUsersGenesys(users.userId);
    return { response: results };
  } catch (error) {
    console.log(error);
    return { error: 'ERROR' };
  }
}
async function logoutUsersGenesys(usersId) {
  if (usersId.length === 0) {
    return [];
  }
  var results = [];
  await client.loginClientCredentialsGrant(clientId, clientSecret);
  for (let index = 0; index < usersId.length; index++) {
    var options = {
      source: 'PURECLOUD',
      primary: true,
      presenceDefinition: {
        id: 'ccf3c10a-aa2c-4845-8e8d-f59fa48c58e5',
      },
    };
    await presence.patchUserPresencesPurecloud(usersId[index], options);
    var resultNew = await tokens.deleteToken(usersId[index]);
    results.push(resultNew);
  }
  return results;
}
async function sendEmail(dataReq) {
  const auth = {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PWD,
    method: 'LOGIN',
  };
  // Convertir métodos callback a Promesas
  const connect = promisify(connection.connect).bind(connection);
  const login = promisify(connection.login).bind(connection);
  const send = promisify(connection.send).bind(connection);
  const quit = promisify(connection.quit).bind(connection);

  try {
    console.log('Entro funcion sendEmail');
    var htmlTableUsersLogout = await generateTableAgentsLogout(
      dataReq.arrayLogoutUserWithNames,
    );
    console.log('Conectando al servidor SMTP...');
    await connect();
    console.log('Autenticando...');
    await login({
      user: 'notificacionesxkale@recover.ec',
      pass: 'X/048300692008ov',
      method: 'LOGIN',
    });
    const envelope = {
      from: 'notificacionesxkale@recover.ec',
      to: [
        'notificaciones.recover@xkale.com',
        'notificacionesgenesys@recover.ec',
      ],
    };
    const message = [
      'From: Monitor Licencias Recover <notificacionesxkale@recover.ec>',
      'To: notificaciones.recover@xkale.com, notificacionesgenesys@recover.ec',
      'Subject: AWS/NM - Reporte de licencias Genesys Cloud que exceden el umbral permitido',
      'Content-Type: text/html; charset=utf-8',
      '',
      "<html><body><p>&nbsp;</p><h3 style ='text-align: center; color: #baa535';'font - family: verdana';'><span style = 'border-bottom: 4px solid #c82828;'font - family: verdana';'>REPORTE DE LICENCIAS CONCURRENTES UTILIZADAS GENESYS CLOUD</span></h3><p style='font - family: verdana';> A continuacion un detalle de las licencias que estan siendo utilizadas actualmente en su organizacion:<strong> Recover</strong></p><p style='font - family: verdana';>Recuerde que a partir de 20 minutos de uso de una licencia nueva se genera un cargo adicional a su plan actual contratado con Genesys Cloud.<strong> Licencias contratadas: " +
        dataReq.licenseSubs +
        '</strong></p>' +
        htmlTableUsersLogout +
        "<p style='font - family: verdana'><strong>Tabla actualizada a la fecha actual.<br/> TOTAL DE LICENCIAS UTILIZADAS: " +
        dataReq.totalLic +
        "</strong></p><table border='1';bgcolor='#FFFDA3'; class='demoTable' style='height: 54px;'><thead><tr><td><span style = 'color: #c82828;'>Estado</span></td><td><span style='color: #c82828;'>Total</span></td></tr></thead><tbody><tr><td>Disponibles</td><td>" +
        dataReq.countAvailable +
        '</td></tr><tr><td>Desconectados</td><td>' +
        dataReq.countOffline +
        '</td></tr><tr><td>En Cola</td><td>' +
        dataReq.countOnQueue +
        '</td></tr><tr><td>Ocupados</td><td>' +
        dataReq.countBusy +
        '</td></tr><tr><td>En Reunión</td><td>' +
        dataReq.countMeeting +
        '</td></tr><tr><td>En Capacitación</td><td>' +
        dataReq.countTraining +
        '</td></tr><tr><td>Descanso</td><td>' +
        dataReq.countBreak +
        '</td></tr><tr><td>Ausente</td><td>' +
        dataReq.countAway +
        '</td></tr><tr><td>Comida</td><td>' +
        dataReq.countMeal +
        "</td></tr></tbody></table><p>&nbsp;</p><p>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; Revisa<a target='_blank' rel='nofollow noopener' href='https://help.mypurecloud.com/articles/billing-faqs/'> Genesys Cloud</a> para detalle del manejo de licencias.</p></body></html>",
    ].join('\n');
    console.log('Enviando correo...');
    const result = await send(envelope, message);
    console.log('Correo enviado:', result);

    //await quit();

    return {
      statusCode: 200,
      body: 'Correo enviado correctamente',
    };
  } catch (error) {
    console.error('❌ Error al enviar el correo:', {
      message: error.message,
      code: error.code,
      response: error.response,
    });
    // Intentar cerrar conexión si aún está abierta
    try {
      await quit();
    } catch (_) {}

    return { error: 'ERROR: ' };
  }
}
async function sendEmailTest(dataReq) {
  const auth = {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PWD,
    method: 'LOGIN',
  };
  // Convertir métodos callback a Promesas
  const connect = promisify(connection.connect).bind(connection);
  const login = promisify(connection.login).bind(connection);
  const send = promisify(connection.send).bind(connection);
  const quit = promisify(connection.quit).bind(connection);

  try {
    console.log('Entro funcion sendEmail');
    var htmlTableUsersLogout = await generateTableAgentsLogout(
      dataReq.arrayLogoutUserWithNames,
    );
    console.log('Conectando al servidor SMTP...');
    await connect();
    console.log('Autenticando...');
    await login({
      user: 'notificacionesxkale@recover.ec',
      pass: 'X/048300692008ov',
      method: 'LOGIN',
    });
    const envelope = {
      from: 'notificacionesxkale@recover.ec',
      to: ['dcalatrava@hightelecom.com', 'rlopez@xkale.com'],
    };
    const message = [
      'From: Monitor Licencias Recover <notificacionesxkale@recover.ec>',
      'To: dcalatrava@hightelecom.com, rlopez@xkale.com',
      'Subject: AWS/NM - Reporte de licencias Genesys Cloud que exceden el umbral permitido',
      'Content-Type: text/html; charset=utf-8',
      '',
      "<html><body><p>&nbsp;</p><h3 style ='text-align: center; color: #baa535';'font - family: verdana';'><span style = 'border-bottom: 4px solid #c82828;'font - family: verdana';'>REPORTE DE LICENCIAS CONCURRENTES UTILIZADAS GENESYS CLOUD</span></h3><p style='font - family: verdana';> A continuacion un detalle de las licencias que estan siendo utilizadas actualmente en su organizacion:<strong> Recover</strong></p><p style='font - family: verdana';>Recuerde que a partir de 20 minutos de uso de una licencia nueva se genera un cargo adicional a su plan actual contratado con Genesys Cloud.<strong> Licencias contratadas: " +
        dataReq.licenseSubs +
        '</strong></p>' +
        htmlTableUsersLogout +
        "<p style='font - family: verdana'><strong>Tabla actualizada a la fecha actual.<br/> TOTAL DE LICENCIAS UTILIZADAS: " +
        dataReq.totalLic +
        "</strong></p><table border='1';bgcolor='#FFFDA3'; class='demoTable' style='height: 54px;'><thead><tr><td><span style = 'color: #c82828;'>Estado</span></td><td><span style='color: #c82828;'>Total</span></td></tr></thead><tbody><tr><td>Disponibles</td><td>" +
        dataReq.countAvailable +
        '</td></tr><tr><td>Desconectados</td><td>' +
        dataReq.countOffline +
        '</td></tr><tr><td>En Cola</td><td>' +
        dataReq.countOnQueue +
        '</td></tr><tr><td>Ocupados</td><td>' +
        dataReq.countBusy +
        '</td></tr><tr><td>En Reunión</td><td>' +
        dataReq.countMeeting +
        '</td></tr><tr><td>En Capacitación</td><td>' +
        dataReq.countTraining +
        '</td></tr><tr><td>Descanso</td><td>' +
        dataReq.countBreak +
        '</td></tr><tr><td>Ausente</td><td>' +
        dataReq.countAway +
        '</td></tr><tr><td>Comida</td><td>' +
        dataReq.countMeal +
        "</td></tr></tbody></table><p>&nbsp;</p><p>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; Revisa<a target='_blank' rel='nofollow noopener' href='https://help.mypurecloud.com/articles/billing-faqs/'> Genesys Cloud</a> para detalle del manejo de licencias.</p></body></html>",
    ].join('\n');
    console.log('Enviando correo...');
    const result = await send(envelope, message);
    console.log('Correo enviado:', result);

    //await quit();

    return {
      statusCode: 200,
      body: 'Correo enviado correctamente',
    };
  } catch (error) {
    console.error('❌ Error al enviar el correo:', {
      message: error.message,
      code: error.code,
      response: error.response,
    });
    // Intentar cerrar conexión si aún está abierta
    try {
      await quit();
    } catch (_) {}

    return { error: 'ERROR: ' };
  }
}
async function sendEmailAdmin(dataReq) {
  try {
    console.log('Entro funcion sendEmailAdmin');
    // create transporter object with smtp server details
    var htmlTableUsersLogout = await generateTableAgentsLogout(
      dataReq.arrayLogoutUserWithNames,
    );
    const params = {
      Source: 'soporte@hightelecom.com', // Debe estar verificado
      Destination: {
        ToAddresses: [
          'notificaciones.recover@xkale.com',
          'clagla@recover.ec',
          'aherrera@recover.ec',
          'jlucumi@recover.ec',
          'jimbaquingo@recover.ec',
          'lzambrano@recover.ec',
          'cnarvaez@recover.ec',
          'kholguin@recover.ec',
          'ecruz@recover.ec',
          'jlucas@recover.ec',
          'asistenteoperaciones@recover.ec',
          'alopez@recover.ec',
          'graza@recover.ec',
          'fcarrion@recover.ec',
          'marellano@recover.ec',
          'barias@recover.ec',
          'pcortez@recover.ec',
        ], // Puede ser verificado si estás en sandbox
      },
      Message: {
        Subject: {
          Data: 'AWS - Reporte de licencias Genesys Cloud que exceden el umbral permitido',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data:
              "<html><body><p>&nbsp;</p><h3 style ='text-align: center; color: #baa535';'font - family: verdana';'><span style = 'border-bottom: 4px solid #c82828;'font - family: verdana';'>REPORTE DE LICENCIAS CONCURRENTES UTILIZADAS GENESYS CLOUD</span></h3><p style='font - family: verdana';> A continuacion un detalle de las licencias que estan siendo utilizadas actualmente en su organizacion:<strong> Recover</strong></p><p style='font - family: verdana';>Recuerde que a partir de 20 minutos de uso de una licencia nueva se genera un cargo adicional a su plan actual contratado con Genesys Cloud.<strong> Licencias contratadas: " +
              dataReq.licenseSubs +
              '</strong></p>' +
              htmlTableUsersLogout +
              "<p style='font - family: verdana'><strong>Tabla actualizada a la fecha actual.<br/> TOTAL DE LICENCIAS UTILIZADAS: " +
              dataReq.totalLic +
              "</strong></p><table border='1';bgcolor='#FFFDA3'; class='demoTable' style='height: 54px;'><thead><tr><td><span style = 'color: #c82828;'>Estado</span></td><td><span style='color: #c82828;'>Total</span></td></tr></thead><tbody><tr><td>Disponibles</td><td>" +
              dataReq.countAvailable +
              '</td></tr><tr><td>Desconectados</td><td>' +
              dataReq.countOffline +
              '</td></tr><tr><td>En Cola</td><td>' +
              dataReq.countOnQueue +
              '</td></tr><tr><td>Ocupados</td><td>' +
              dataReq.countBusy +
              '</td></tr><tr><td>En Reunión</td><td>' +
              dataReq.countMeeting +
              '</td></tr><tr><td>En Capacitación</td><td>' +
              dataReq.countTraining +
              '</td></tr><tr><td>Descanso</td><td>' +
              dataReq.countBreak +
              '</td></tr><tr><td>Ausente</td><td>' +
              dataReq.countAway +
              '</td></tr><tr><td>Comida</td><td>' +
              dataReq.countMeal +
              "</td></tr></tbody></table><p>&nbsp;</p><p>&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; Revisa<a target='_blank' rel='nofollow noopener' href='https://help.mypurecloud.com/articles/billing-faqs/'> Genesys Cloud</a> para detalle del manejo de licencias.</p></body></html>",
            Charset: 'UTF-8',
          },
        },
      },
    };
    const result = await ses.sendEmail(params).promise();
    console.log('✅ Correo enviado:', result.MessageId);
    return {
      statusCode: 200,
      response: JSON.stringify({ success: true, messageId: result.MessageId }),
    };
  } catch (error) {
    await sendEmail(dataReq);
    console.error('❌ Error al enviar correo:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    throw error; // Opcionalmente vuelve a lanzar el error
  }
}
// Función para crear la tabla
async function generateTableAgentsLogout(usuarios) {
  let html = `
      <h2>Lista de Usuarios Deslogueados</h2>
      <table border='1';bgcolor='#FFFDA3'; class='demoTable' style='height: 54px;'>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
          </tr>
        </thead>
        <tbody>
  `;
  if (usuarios.length > 0) {
    usuarios.forEach((usuario) => {
      html += `
      <tr>
        <td>${usuario.name}</td>
        <td>${usuario.email}</td>
      </tr>
    `;
    });
  }

  html += `
        </tbody>
      </table>
  `;

  return html;
}

async function getUsersPresence() {
  try {
    usersgenesys = { entities: [] };
    await client.loginClientCredentialsGrant(clientId, clientSecret);
    let data = await users.getUsers(opts);
    //console.log(`getUsers success! data: ${JSON.stringify(data, null, 2)}`);
    data.entities.forEach((element) => {
      usersgenesys.entities.push(element);
    });
    if (data.pageNumber <= data.pageCount) {
      await getUsers(data.pageNumber + 1);
      return usersgenesys;
    } else {
      return usersgenesys;
    }
  } catch (error) {
    console.log(error);
  }
}
async function getUsers(page) {
  let opts2 = {
    pageSize: 500,
    expand: ['presence', 'dateLastLogin'],
    pageNumber: page,
  };
  let data = await users.getUsers(opts2);
  //console.log(`getUsers success! data: ${JSON.stringify(data, null, 2)}`);
  data.entities.forEach((element) => {
    usersgenesys.entities.push(element);
  });

  if (data.pageNumber <= data.pageCount) {
    getUsers(data.pageNumber + 1);
  } else {
    return '200 OK';
  }
}
async function getSubscriptionsGenesys() {
  try {
    usersgenesys = { entities: [] };
    let respLoginGC = await client.loginClientCredentialsGrant(
      clientId,
      clientSecret,
    );
    const options = {
      method: 'GET',
      url: 'https://apps.mypurecloud.com/platform/api/v2/billing/subscriptionoverview',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + respLoginGC.data.accessToken,
      },
    };

    let respGSU = await axios(options);
    respGSU.data.usages.forEach((element) => {
      if (
        element.name === 'PureCloud 2 Concurrent User' ||
        element.partNumber === 'PC-170-NV-USR2C'
      ) {
        var licencesNumber = element.prepayQuantity;
        res.json({
          licences: licencesNumber,
        });
      }
    });
  } catch (error) {
    console.log(error);
    res.json({
      response: 'Error: ' + error,
      status:
        'Se ha presentado un error en obtener las suscripciones en Genesys',
    });
  }
}
