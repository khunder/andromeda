
import Utils from "./src/utils/utils.js";
import constants from "./src/config/constants.js";


if (Utils.moduleIsActive(constants.SERVER)) {
    // let Engine =  await import('./src/modules/engine/engine.js');
    import ('./src/modules/engine/engine.js').then(Engine => {
        const server =  new Engine.default().start("127.0.0.1", 5000)
    })

}

if (Utils.moduleIsActive(constants.PERSISTENCE)) {
    let Persistence = await import('./src/modules/persistence/persistence.js')
    const persistnce = new (await Persistence)().start();
}







