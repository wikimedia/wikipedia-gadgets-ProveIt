/**
 * ProveIt is a powerful GUI tool to find, edit, add and cite references in any MediaWiki wiki
 * Full documentation at https://commons.wikimedia.org/wiki/Help:Gadget-ProveIt
 *
 * Copyright 2008-2011 Georgia Tech Research Corporation, Atlanta, GA 30332-0415, ALL RIGHTS RESERVED
 * Copyright 2011- Matthew Flaschen
 * Rewritten, internationalized, enhanced and maintained by Felipe Schenone since 2014
 *
 * ProveIt is available under the GNU Free Documentation License (http://www.gnu.org/copyleft/fdl.html),
 * the Creative Commons Attribution/Share-Alike License 3.0 (http://creativecommons.org/licenses/by-sa/3.0/),
 * and the GNU General Public License 2 (http://www.gnu.org/licenses/gpl-2.0.html)
 */

( function ( mw, $ ) {

var proveit = {

	/**
	 * Interface messages
	 */
	messages: {
		'en': {
			'proveit-edit-tab': 'Edit',
			'proveit-add-tab': 'Add',
			'proveit-reference-name-label': 'Reference name',
			'proveit-reference-text-label': 'Reference text',
			'proveit-template-label': 'Template',
			'proveit-insert-button': 'Insert',
			'proveit-update-button': 'Update',
			'proveit-no-references': 'No references found'
		},
		'es': {
			'proveit-edit-tab': 'Editar',
			'proveit-add-tab': 'Agregar',
			'proveit-reference-name-label': 'Nombre de la referencia',
			'proveit-reference-text-label': 'Texto de la referencia',
			'proveit-template-label': 'Plantilla',
			'proveit-insert-button': 'Insertar',
			'proveit-update-button': 'Actualizar',
			'proveit-no-references': 'No se han encontrado referencias'
		}
	},

	/**
	 * Template data retrieved from the wiki
	 *
	 * @type {object}
	 */
	templates: {},

	/**
	 * Interface language
	 * The default or fallback language is English
	 *
	 * @type {string}
	 */
	userLanguage: 'en',

	/**
	 * Convenience method to get a ProveIt option
	 *
	 * @param {string} option key without the "proveit-" prefix
	 * @return {string} option value
	 */
	getOption: function ( key ) {
		return mw.config.get( 'proveit-' + key );
	},

	/**
	 * Convenience method to get a ProveIt message
	 *
	 * @param {string} message key without the "proveit-" prefix
	 * @return {string} message value
	 */
	getMessage: function ( key ) {
		return mw.message( 'proveit-' + key ).text();
	},

	/**
	 * Convenience method to get the edit textbox
	 *
	 * @return {jQuery} Edit textbox
	 */
	getTextbox: function () {
		return $( '#wpTextbox1' );
	},

	/**
	 * Initialization script
	 *
	 * @return {void}
	 */
	init: function () {

		// Set the interface language
		var userLanguage = mw.config.get( 'wgUserLanguage' );
		if ( userLanguage in proveit.messages ) {
			proveit.userLanguage = userLanguage;
		}
		mw.messages.set( proveit.messages[ userLanguage ] );

		// Build the interface
		proveit.build();

		// Get the template data from the wiki
		new mw.Api().get({
			'action': 'templatedata',
			'titles': proveit.getOption( 'templates' ).join( '|' ),
			'format': 'json'
		}).done( function ( data ) {
			//console.log( data );
			for ( var page in data.pages ) {
				page = data.pages[ page ];
				proveit.templates[ page.title ] = page.params; // Set the template data
			}
			proveit.scanForReferences();
		});
	},

	/**
	 * Build the GUI and insert it into the DOM
	 *
	 * @return {void}
	 */
	build: function () {

		// Define the basic elements
		var gui = $( '<div>' ).attr( 'id', 'proveit' ),
			header = $( '<div>' ).attr( 'id', 'proveit-header' ),
			logo = $( '<span>' ).attr( 'id', 'proveit-logo' ).text( 'ProveIt' ),
			leftBracket = $( '<span>' ).attr( 'id', 'proveit-left-bracket' ).text( '[' ),
			rightBracket = $( '<span>' ).attr( 'id', 'proveit-right-bracket' ).text( ']' ),
			editTab = $( '<span>' ).attr( 'id', 'proveit-edit-tab' ).addClass( 'active' ).text( proveit.getMessage( 'edit-tab' ) ),
			addTab = $( '<span>' ).attr( 'id', 'proveit-add-tab' ).text( proveit.getMessage( 'add-tab' ) ),
			content = $( '<div>' ).attr( 'id', 'proveit-content' );

		// Put everything together and add it to the DOM
		logo.prepend( leftBracket ).append( rightBracket );
		header.append( logo, editTab, addTab );
		gui.append( header,	content );
		$( 'body' ).prepend( gui );

		// Make the GUI draggable
		var dragged = false;
		gui.draggable({
			handle: header,
			containment: 'window',
			start: function ( event ) {
				if ( event.toElement.id !== 'proveit-header' ) {
					dragged = true;
				}
				gui.css({
					'right': 'auto',
					'bottom': 'auto'
				});
			}
		});

		// Lastly, bind events
		logo.click( function () {
			if ( dragged ) {
				dragged = false; // Reset the flag
				return;
			}
			editTab.toggle();
			addTab.toggle();
			content.toggle();
			gui.css({
				'top': 'auto',
				'left': 'auto',
				'right': 0,
				'bottom': 0
			});
		}).click(); // Click the logo to hide the gadget by default

		editTab.click( function () {
			if ( dragged ) {
				dragged = false; // Reset the flag
				return;
			}
			$( this ).addClass( 'active' ).siblings().removeClass( 'active' );

			proveit.scanForReferences();
		});

		addTab.click( function () {
			if ( dragged ) {
				dragged = false; // Reset the flag
				return;
			}
			$( this ).addClass( 'active' ).siblings().removeClass( 'active' );

			// Create an dummy reference and a dummy form out of it
			var template = $.cookie( 'proveit-last-template' );
			if ( !template ) {
				template = Object.keys( proveit.templates )[0];
				template = template.substring( template.indexOf( ':' ) + 1 );
			}
			var dummyReference = new proveit.TemplateReference({ 'template': template }),
				dummyForm = dummyReference.toForm();

			content.html( dummyForm );

			$( '#proveit-update-button' ).hide();
		});
	},

	/**
	 * Scan for references in the textbox and display them
	 *
	 * @return {boolean} Whether the scan succeeded and found at least one reference
	 */
	scanForReferences: function () {

		// First define the list element
		var referenceList = $( '<ul>' ).attr( 'id', 'proveit-reference-list' );

		// Second, look for all the citations in the wikitext and store them in an array for later
		var wikitext = proveit.getTextbox().val(),
			citations = [],
			citationsRegExp = /<\s*ref\s+name\s*=\s*["|']?\s*([^"'\s]+)\s*["|']?\s*\/\s*>/ig, // Three possibilities: <ref name="foo" />, <ref name='foo' /> and <ref name=foo />
			match,
			citation;

		while ( ( match = citationsRegExp.exec( wikitext ) ) ) {
			citation = new proveit.Citation({ 'name': match[1], 'index': match.index, 'string': match[0] });
			citations.push( citation );
		}

		// Third, look for all the raw and template references
		var matches = wikitext.match( /<\s*ref[^\/]*>[\s\S]*?<\s*\/\s*ref\s*>/ig );

		if ( !matches ) {
			var noReferencesMessage = $( '<div>' ).attr( 'id', 'proveit-no-references-message' ).text( proveit.getMessage( 'no-references' ) );
			referenceList.append( noReferencesMessage );
			return false;
		}

		var i, j, reference, referenceItem;
		for ( i = 0; i < matches.length; i++ ) {
			// Turn all the matches into reference objects
			reference = proveit.makeReference( matches[ i ] );

			// For each reference, check the citations array for citations to it
			for ( j = 0; j < citations.length; j++ ) {
				citation = citations[ j ];
				if ( reference.name === citation.name ) {
					reference.citations.push( citation );
				}
			}

			// Finally, turn all the references into list items and insert them into the reference list
			referenceItem = reference.toListItem();
			referenceList.append( referenceItem );
		}

		$( '#proveit-content' ).html( referenceList );
	},

	/**
	 * Make a reference object out of a reference string
	 *
	 * @param {string} Wikitext of the reference
	 * @return {Citation|RawReference|TemplateReference} Reference object of the appropriate class
	 */
	makeReference: function ( referenceString ) {

		// First we need to determine what kind of reference we're dealing with
		// So we get all the template names and search for a match
		var registeredTemplate,
			registeredTemplatesArray = [];
		for ( registeredTemplate in proveit.templates ) {
			registeredTemplate = registeredTemplate.substring( registeredTemplate.indexOf( ':' ) + 1 ); // Remove the namespace
			registeredTemplatesArray.push( registeredTemplate );
		}
		var registeredTemplatesDisjunction = registeredTemplatesArray.join( '|' ),
			regExp = new RegExp( '{{(' + registeredTemplatesDisjunction + ')([\\s\\S]*)}}', 'i' ),
			match = referenceString.match( regExp ),
			referenceText,
			reference;

		if ( match ) {
			referenceText = match[2];
			reference = new proveit.TemplateReference({ 'string': referenceString, 'text': referenceText });

			// Extract the name of the template
			var template = match[1];

			// Normalize it
			registeredTemplatesArray.forEach( function ( registeredTemplate ) {
				if ( template.toLowerCase() === registeredTemplate.toLowerCase() ) {
					template = registeredTemplate;
				}
			});
			reference.template = template;

			// Next, extract the parameters
			var paramsArray = referenceText.split( '|' ),
				paramString, paramNameAndValue, paramName, paramValue;

			paramsArray.shift(); // Remove everything before the fist pipe

			for ( paramString in paramsArray ) {

				paramNameAndValue = paramsArray[ paramString ].split( '=' );
				paramName = $.trim( paramNameAndValue[0] );
				paramValue = $.trim( paramNameAndValue[1] );

				if ( !paramName || !paramValue ) {
					continue;
				}

				reference.params[ paramName ] = paramValue;
			}
		} else {
			referenceText = referenceString.match( />([\s\S]*)<\s*\/\s*ref\s*>/i )[1];
			reference = new proveit.RawReference({ 'string': referenceString, 'text': referenceText });
		}

		// Now set the starting index of the reference
		var text = proveit.getTextbox().val();
		reference.index = text.indexOf( referenceString );

		// Lastly, extract the name of the reference, if any
		// Three possibilities: <ref name="foo">, <ref name='foo'> and <ref name=foo>
		regExp = /<[\s]*ref[\s]*name[\s]*=[\s]*(?:(?:\"(.*?)\")|(?:\'(.*?)\')|(?:(.*?)))[\s]*>/i;
		match = referenceString.match( regExp );
		if ( match ) {
			reference.name = match[1] || match[2] || match[3];
		}

		return reference;
	},

	/**
	 * Add the ProveIt revision tag
	 *
	 * @return {void}
	 */
	addTag: function () {
		var tag = proveit.getOption( 'tag' );
		if ( !tag ) {
			return; // No tag defined
		}
		if ( $( '#wpChangeTags' ).length > 0 ) {
			return; // Don't add it twice
		}
		var tagInput = $( '<input>' ).attr({
			'id': 'wpChangeTags',
			'type': 'hidden',
			'name': 'wpChangeTags',
			'value': tag
		});
		$( '#editform' ).append( tagInput );
	},

	/**
	 * Add the ProveIt edit summary
	 *
	 * @return {void}
	 */
	addSummary: function () {
		var currentSummary = $( '#wpSummary' ).val(),
			proveitSummary = proveit.getOption( 'summary' );
		if ( !proveitSummary ) {
			return; // No summary defined
		}
		if ( currentSummary.indexOf( 'ProveIt' ) > -1 ) {
			return; // Don't add it twice
		}
		$( '#wpSummary' ).val( currentSummary ? currentSummary + ' - ' + proveitSummary : proveitSummary );
	},

	/**
	 * Class for citations: <ref name="some-reference" />
	 *
	 * The citation class is the base class. It has the properties and methods common to all references.
	 *
	 * @param {object} Data for constructing the object
	 */
	Citation: function ( data ) {

		/**
		 * Name of the class
		 */
		this.type = 'Citation';

		/**
		 * Name of the reference
		 *
		 * This is the value of the "name" parameter of the <ref> tag: <ref name="abc" />
		 */
		this.name = data.name;

		/**
		 * Location of this reference in the edit textbox
		 */
		this.index = data.index;

		/**
		 * Wikitext for this reference.
		 */
		this.string = data.string;

		/**
		 * Highlight the string in the textbox and scroll it to view
		 *
		 * @return {void}
		 */
		this.highlight = function () {
			var textbox = proveit.getTextbox()[0],
				text = textbox.value;

			// Scroll to the string
			textbox.value = text.substring( 0, this.index );
			textbox.focus();
			textbox.scrollTop = 99999999; // Larger than any real textarea (hopefully)
			var currentScrollTop = textbox.scrollTop;
			textbox.value += text.substring( this.index );
			if ( currentScrollTop > 0 ) {
				textbox.scrollTop = currentScrollTop + 300;
			}

			// Highlight the string
			var start = this.index,
				end = start + this.string.length;
			$( textbox ).focus().textSelection( 'setSelection', { 'start': start, 'end': end } );
		};
	},

	/**
	 * Class for raw references: <ref>This is a raw reference, it uses no templates.</ref>
	 *
	 * @extends Citation
	 * @param {object} Data for constructing the object
	 */
	RawReference: function ( data ) {

		/**
		 * Extend the Citation class
		 */
		proveit.Citation.call( this, data );

		/**
		 * Name of the class
		 *
		 * Overrides the value inherited from the Citation class.
		 */
		this.type = 'RawReference';

		/**
		 * Array of citations to this reference
		 */
		this.citations = [];

		/**
		 * String inside the <ref> tags
		 */
		this.text = data.text;

		/**
		 * Convert this reference to wikitext
		 *
		 * This method is trivial, but it needs to exist because it isn't trivial in the TemplateReference class,
		 * and sometimes we call it on a reference object without knowing if it's a raw reference or a template reference.
		 *
		 * @return {string} wikitext for this reference
		 */
		this.toString = function () {
			var string = '<ref';

			if ( this.name ) {
				string += ' name="' + this.name + '"';
			}

			string += '>' + this.text + '</ref>';

			return string;
		};

		/**
		 * Convert this reference to a list item ready to be inserted into the reference list
		 *
		 * @return {jQuery} jQuery-wrapped <li>
		 */
		this.toListItem = function () {

			var item = $( '<li>' ).addClass( 'proveit-reference-item' ).text( this.text ),
				citations = $( '<span>' ).addClass( 'proveit-citations' );

			for ( var i = 0; i < this.citations.length; i++ ) {
				citations.append( $( '<a>' ).addClass( 'proveit-citation' ).text( i + 1 ) );
			}

			item.append( citations );

			// Bind events
			var reference = this;
			item.click( function () {
				reference.highlight();
				var form = reference.toForm();
				$( '#proveit-content' ).html( form );
				$( '#proveit-insert-button' ).hide();
			});

			item.find( 'a.proveit-citation' ).click( function ( event ) {
				event.stopPropagation();
				var i = parseInt( $( this ).text(), 10 ) - 1,
					citation = reference.citations[ i ];
				citation.highlight();
				return false;
			});

			return item;
		};

		/**
		 * Convert this reference into a HTML form filled with its data
		 *
		 * @return {jQuery} jQuery-wrapped <form>
		 */
		this.toForm = function () {

			var form = $( '<form>' ).attr( 'id', 'proveit-reference-form' ),
				table = $( '<table>' );

			// Insert the <ref> name field
			var referenceNameRow = $( '<tr>' ),
				referenceNameLabel = $( '<label>' ).text( proveit.getMessage( 'reference-name-label' ) ),
				referenceNameInput = $( '<input>' ).attr( 'name', 'reference-name' ).val( this.name );
			referenceNameRow.append( referenceNameLabel, referenceNameInput );
			table.append( referenceNameRow );

			// Insert the textarea
			var referenceTextRow = $( '<tr>' ),
				referenceTextLabel = $( '<label>' ).text( proveit.getMessage( 'reference-text-label' ) ),
				referenceTextArea = $( '<textarea>' ).attr( 'name', 'reference-text' ).val( this.text );
			referenceTextRow.append( referenceTextLabel, referenceTextArea );
			table.append( referenceTextRow );

			// Insert the buttons
			var buttons = $( '<div>' ).attr( 'id', 'proveit-buttons' ),
				updateButton = $( '<button>' ).attr( 'id', 'proveit-update-button' ).text( proveit.getMessage( 'update-button' ) ),
				insertButton = $( '<button>' ).attr( 'id', 'proveit-insert-button' ).text( proveit.getMessage( 'insert-button' ) );
			buttons.append( updateButton, insertButton );
			form.append( table, buttons );

			// Bind events
			form.submit( false );

			updateButton.click( this, this.update );

			insertButton.click( this, this.insert );

			return form;
		};

		/**
		 * Update the data of this reference with the content of the reference form
		 *
		 * @return {void}
		 */
		this.loadFromForm = function () {
			this.name = $( '#proveit-reference-form input[name="reference-name"]' ).val();
			this.text = $( '#proveit-reference-form textarea[name="reference-text"]' ).val();
			this.string = this.toString();
		};

		/**
		 * Update the wikitext in the textbox with the current data of this reference
		 *
		 * @return {void}
		 */
		this.update = function ( event ) {
			var reference = event.data;

			var oldString = reference.string;
			reference.loadFromForm();
			var newString = reference.string;

			// Replace the old reference
			var textbox = proveit.getTextbox(),
				text = textbox.val().replace( oldString, newString );

			textbox.val( text );

			// Update the index and highlight the reference
			text = textbox.val();
			reference.index = text.indexOf( newString );
			reference.highlight();

			// Add the tag, the summary and rescan
			proveit.addTag();
			proveit.addSummary();
		};

		/**
		 * Insert this reference into the textbox
		 *
		 * @return {void}
		 */
		this.insert = function ( event ) {
			var reference = event.data;

			reference.loadFromForm();

			// Replace the existing selection (if any)
			var string = reference.string,
				textbox = proveit.getTextbox();

			textbox.textSelection( 'encapsulateSelection', {
				'peri': string,
				'replace': true
			});

			// Update the index and highlight the reference
			reference.index = textbox.val().indexOf( reference.string );
			reference.highlight();

			// Add the tag, the summary and rescan
			proveit.addTag();
			proveit.addSummary();
		};
	},

	/**
	 * Class for template references: <ref>{{Cite book |first=Charles |last=Darwin |title=The Origin of Species}}</ref>
	 *
	 * @extends RawReference
	 * @param {object} Data for constructing the object
	 */
	TemplateReference: function ( data ) {

		/**
		 * Extend the RawReference class
		 */
		proveit.RawReference.call( this, data );

		/**
		 * Name of the class
		 *
		 * Overrides the value inherited from the RawReference class.
		 */
		this.type = 'TemplateReference';

		/**
		 * Name of the template used by this reference.
		 */
		this.template = data.template;

		/**
		 * Object mapping the parameter names of this reference to their values
		 *
		 * This object is constructed directly out of the wikitext, so it doesn't include
		 * any information about the parameters other than their names and values,
		 */
		this.params = {};

		/**
		 * Get the registered parameters for this reference
		 *
		 * @return {object}
		 */
		this.getRegisteredParams = function () {
			var formattedNamespaces = mw.config.get( 'wgFormattedNamespaces' );
				templateNamespace = formattedNamespaces[10];
			return proveit.templates[ templateNamespace + ':' + this.template ];
		};

		/**
		 * Get the required parameters for this reference
		 *
		 * @return {object}
		 */
		this.getRequiredParams = function () {
			var requiredParams = {},
				registeredParams = this.getRegisteredParams();
			for ( var registeredParam in registeredParams ) {
				if ( registeredParams[ registeredParam ].required ) {
					requiredParams[ registeredParam ] = registeredParams[ registeredParam ];
				}
			}
			return requiredParams;
		};

		/**
		 * Get the suggested parameters for this reference
		 *
		 * @return {object}
		 */
		this.getSuggestedParams = function () {
			var suggestedParams = {},
				registeredParams = this.getRegisteredParams();
			for ( var registeredParam in registeredParams ) {
				if ( registeredParams[ registeredParam ].suggested ) {
					suggestedParams[ registeredParam ] = suggestedParams[ registeredParam ];
				}
			}
			return suggestedParams;
		};

		/**
		 * Get the optional parameters for this reference
		 *
		 * @return {object}
		 */
		this.getOptionalParams = function () {
			var optionalParams = {},
				registeredParams = this.getRegisteredParams();
			for ( var registeredParam in registeredParams ) {
				if ( !registeredParams[ registeredParam ].required && !registeredParams[ registeredParam ].suggested ) {
					optionalParams[ registeredParam ] = registeredParams[ registeredParam ];
				}
			}
			return optionalParams;
		};

		/**
		 * Convert this reference to wikitext
		 *
		 * Overrides the toString() method of the RawReference class.
		 *
		 * @return {string} Wikitext for this reference
		 */
		this.toString = function () {
			var string = '<ref';

			if ( this.name ) {
				string += ' name="' + this.name + '"';
			}

			string += '>{{' + this.template;

			for ( var name in this.params ) {
				string += ' |' + name + '=' + this.params[ name ];
			}

			string += '}}</ref>';

			return string;
		};

		/**
		 * Convert this reference to a list item
		 *
		 * Overrides the toListItem() method of the RawReference class.
		 *
		 * @return {jQuery} jQuery-wrapped node for reference list
		 */
		this.toListItem = function () {

			var item = $( '<li>' ).addClass( 'proveit-reference-item' );

			item.append( $( '<span>' ).addClass( 'proveit-template' ).text( this.template ) );
			var requiredParams = this.getRequiredParams(),
				requiredParam,
				requiredParamValue;
			for ( requiredParam in requiredParams ) {
				requiredParamValue = this.params[ requiredParam ];
				item.append( $( '<span>' ).addClass( 'proveit-required-value' ).text( requiredParamValue ) );
			}

			var citations = $( '<span>' ).addClass( 'proveit-citations' );

			for ( var i = 0; i < this.citations.length; i++ ) {
				citations.append( $( '<a>' ).addClass( 'proveit-citation' ).text( i + 1 ) );
			}

			item.append( citations );

			// Bind events
			var reference = this;
			item.click( function () {
				reference.highlight();
				var form = reference.toForm();
				$( '#proveit-content' ).html( form );
				$( '#proveit-insert-button' ).hide();
			});

			item.find( 'a.proveit-citation' ).click( function ( event ) {
				event.stopPropagation();
				var i = parseInt( $( this ).text(), 10 ) - 1,
					citation = reference.citations[ i ];
				citation.highlight();
				return false;
			});

			return item;
		};

		/**
		 * Convert this reference into a HTML form filled with its data
		 *
		 * @return {jQuery} jQuery-wrapped <form>
		 */
		this.toForm = function () {

			var form = $( '<form>' ).attr( 'id', 'proveit-reference-form' ),
				table = $( '<table>' );

			// Insert the <ref> name field
			var referenceNameRow = $( '<tr>' ),
				referenceNameLabel = $( '<label>' ).text( proveit.getMessage( 'reference-name-label' ) ),
				referenceNameInput = $( '<input>' ).attr( 'name', 'reference-name' ).val( this.name );
			referenceNameRow.append( referenceNameLabel, referenceNameInput );
			table.append( referenceNameRow );

			// Insert the dropdown menu
			var templateRow = $( '<tr>' ),
				templateLabel = $( '<label>' ).text( proveit.getMessage( 'template-label' ) ),
				templateSelect = $( '<select>' ).attr( 'name', 'template' ),
				templateName,
				templateOption;

			for ( templateName in proveit.templates ) {
				templateName = templateName.substr( templateName.indexOf( ':' ) + 1 ), // Remove the namespace
				templateOption = $( '<option>' ).text( templateName ).val( templateName );
				if ( this.template === templateName ) {
					templateOption.attr( 'selected', 'selected' );
				}
				templateSelect.append( templateOption );
			}
			templateRow.append( templateLabel, templateSelect );
			table.append( templateRow );

			// The insert all the other fields
			var paramName, registeredParam, paramLabel, paramType, paramDescription, paramValue, row, label, paramNameInput, paramValueInput,
				registeredParams = this.getRegisteredParams(),
				requiredParams = this.getRequiredParams(),
				optionalParams = this.getOptionalParams();

			for ( paramName in registeredParams ) {

				registeredParam = registeredParams[ paramName ];

				// Defaults
				paramLabel = paramName;
				paramType = 'text';
				paramDescription = '';
				paramValue = '';

				// Override with template data
				if ( registeredParam.label ) {
					paramLabel = registeredParam.label[ proveit.userLanguage ];
				}
				if ( registeredParam.type ) {
					paramType = registeredParam.type;
				}
				if ( registeredParam.description ) {
					paramDescription = registeredParam.description[ proveit.userLanguage ];
				}
				if ( paramName in this.params ) {
					paramValue = this.params[ paramName ];
				}

				row = $( '<tr>' ).addClass( 'proveit-param-pair' );
				label = $( '<label>' ).attr( 'title', paramDescription ).text( paramLabel );
				paramNameInput = $( '<input>' ).attr( 'type', 'hidden' ).addClass( 'proveit-param-name' ).val( paramName );
				paramValueInput = $( '<input>' ).attr( 'type', paramType ).addClass( 'proveit-param-value' ).val( paramValue );

				// Mark the required parameters as such
				if ( paramName in requiredParams ) {
					row.addClass( 'proveit-required' );
				}

				// Hide the optional parameters, unless they are filled
				if ( ( paramName in optionalParams ) && !paramValue ) {
					row.addClass( 'proveit-optional' );
				}

				row.append( label, paramValueInput, paramNameInput );
				table.append( row );
			}

			// Insert the buttons
			var buttons = $( '<div>' ).attr( 'id', 'proveit-buttons' ),
				updateButton = $( '<button>' ).attr( 'id', 'proveit-update-button' ).text( proveit.getMessage( 'update-button' ) ),
				insertButton = $( '<button>' ).attr( 'id', 'proveit-insert-button' ).text( proveit.getMessage( 'insert-button' ) );
			buttons.append( updateButton, insertButton );
			form.append( table, buttons );

			// Bind events
			var reference = this;
			templateSelect.change( function ( event ) {
				reference.template = $( event.currentTarget ).val();
				$.cookie( 'proveit-last-template', reference.template ); // Remember the user choice
				var form = reference.toForm();
				$( '#proveit-content' ).html( form );
				insertButton.hide();
			});

			form.submit( false );

			updateButton.click( this, this.update );

			insertButton.click( this, this.insert );

			return form;
		};

		/**
		 * Update the data of this reference with the content of the reference form
		 *
		 * @return {void}
		 */
		this.loadFromForm = function () {
			this.name = $( '#proveit-reference-form input[name="reference-name"]' ).val();
			this.template = $( '#proveit-reference-form select[name="template"]' ).val();

			// Load all the parameter key-value pairs
			this.params = {};
			var pairs = $( '#proveit-reference-form .proveit-param-pair' ),
				pair, paramName, paramValue;
			for ( var i = 0; i < pairs.length; i++ ) {
				pair =  pairs[ i ];
				paramName = $( 'input.proveit-param-name', pair ).val();
				paramValue = $( 'input.proveit-param-value', pair ).val();
				if ( paramName !== '' && paramValue !== '' ) {
					this.params[ paramName ] = paramValue;
				}
			}
			this.string = this.toString();
		};
	}
};

$( proveit.init );

}( mw, jQuery ) );