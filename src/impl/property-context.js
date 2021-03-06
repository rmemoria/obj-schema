var utils = require('../commons/utils');
const propertyResolver = require('./property-resolver');
const errorGen = require('./error-generator');
const customValidators = require('./custom-validators');
const customConverters = require('./custom-converters');


module.exports = class PropertyContext {

    constructor(doc, value, property, schema, docSchema, propertyNotDeclared, session) {
        this.doc = doc;
        this.value = value;
        this.property = property;
        this.schema = schema;
        this.docSchema = docSchema;
        this.propertyNotDeclared = !!propertyNotDeclared;
        this.session = session;
    }

    /**
     * Validate the property
     */
    validate() {
        this.value = getDefaultValue(this);

        if (!checkNotNull(this)) {
            return Promise.reject(errorGen.createNotNullMsg(this.property));
        }

        // if there is no value and the property was not declared, so there is nothing to validate
        if (utils.isEmpty(this.value) && this.propertyNotDeclared) {
            return Promise.resolve(PropertyContext.NotAValue);
        }

        const handler = this.session.getHandler(this.schema.type);

        if (!handler) {
            throw new Error('Handler not found for type \'' + this.schema.type + '\'');
        }
    
        return Promise.resolve(customConverters.processBefore(this))
            .then(newval => {
                this.value = newval;
                return Promise.resolve(handler.validate(this));
            })
            .then(newval => {
                // check options
                if (!isInOptions(this)) {
                    return Promise.reject(this.error.invalidValue);
                }
                this.value = newval;
                // call custom validators
                const err = customValidators.processCustomValidators(this);
                if (err) {
                    return Promise.reject(err);
                }
                this.value = newval;
                // call converters
                return customConverters.processAfter(this);
            });
    }

    /**
     * Helper functions to create specific error messages
     */
    get error() {
        const prop = this.property;

        return class ErrorWrapper {
            static as(msg, code) {
                return errorGen.createErrorMsg(prop, msg, code);
            }

            static asCode(code) {
                return errorGen.createErrorMsg(prop, null, code);
            }

            static get notNull() {
                return errorGen.createNotNullMsg(prop);
            }

            static get invalidValue() {
                return errorGen.createInvalidValue(prop);
            }

            static get maxSize() {
                return errorGen.createMaxSizeMsg(prop);
            }

            static get minSize() {
                return errorGen.createMinSizeMsg(prop);
            }

            static get maxValue() {
                return errorGen.createMaxValueMsg(prop);
            }

            static get minValue() {
                return errorGen.createMinValueMsg(prop);
            }
        };
    }
};

/**
 * Check if value is in options (if options available)
 * @param {PropertyContext} context 
 */
function isInOptions(context) {
    const schema = context.schema;

    if (!schema.options) {
        return true;
    }

    const lst = propertyResolver(schema.options, context);

    return lst.indexOf(context.value) >= 0;
}

/**
 * Return the default value, or the own value of the property
 * @param {PropertyContext} propContext the property context
 */
function getDefaultValue(propContext) {
    if (!utils.isEmpty(propContext.value)) {
        return propContext.value;
    }

    if (propContext.schema.defaultValue) {
        return propertyResolver(propContext.schema.defaultValue, propContext);
    }

    return propContext.value;
}

/**
 * Return false if there is no value and it must be provided
 * @param {*} value 
 * @param {*} propSchema 
 */
function checkNotNull(propContext) {
    const res = propertyResolver(propContext.schema.notNull, propContext) === true &&
        utils.isEmpty(propContext.value);
    return !res;
}

module.exports.NotAValue = {};
