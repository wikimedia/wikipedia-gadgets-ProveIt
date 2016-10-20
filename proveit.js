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
	 * URL of the ProveIt icon hosted at Commons
	 */
	ICON: '//upload.wikimedia.org/wikipedia/commons/thumb/1/19/ProveIt_logo_for_user_boxes.svg/22px-ProveIt_logo_for_user_boxes.svg.png',

	/**
	 * Interface messages
	 */
	messages: {
		'en': {
			'proveit-list-tab': 'List ($1)',
			'proveit-add-tab': 'Add',
			'proveit-reference-name-label': 'Reference name',
			'proveit-reference-content-label': 'Reference content',
			'proveit-reference-template-label': 'Main template',
			'proveit-cite-button': 'Cite',
			'proveit-remove-button': 'Remove',
			'proveit-insert-button': 'Insert',
			'proveit-update-button': 'Update',
			'proveit-prompt-name': 'The reference needs a name in order to be cited:',
			'proveit-confirm-remove': 'This will remove the reference and all of its citations. Are you sure?',
			'proveit-no-template': 'No template',
			'proveit-no-references': 'No references found'
		},
		'es': {
			'proveit-list-tab': 'Lista ($1)',
			'proveit-add-tab': 'Agregar',
			'proveit-reference-name-label': 'Nombre de la referencia',
			'proveit-reference-content-label': 'Contenido de la referencia',
			'proveit-reference-template-label': 'Plantilla principal',
			'proveit-cite-button': 'Citar',
			'proveit-remove-button': 'Borrar',
			'proveit-insert-button': 'Insertar',
			'proveit-update-button': 'Actualizar',
			'proveit-prompt-name': 'La referencia necesita un nombre para ser citada:',
			'proveit-confirm-remove': 'Esto borrará la referencia y todas sus citas. ¿Estás seguro?',
			'proveit-no-template': 'Sin plantilla',
			'proveit-no-references': 'No se han encontrado referencias'
		},
		'fr': {
			'proveit-list-tab': 'Lister ($1)',
			'proveit-add-tab': 'Ajouter',
			'proveit-reference-name-label': 'Nom de la référence',
			'proveit-reference-content-label': 'Contenu de la référence',
			'proveit-reference-template-label': 'Modèle de présentation',
			'proveit-cite-button': 'Réutiliser',
			'proveit-remove-button': 'Supprimer',
			'proveit-insert-button': 'Insérer',
			'proveit-update-button': 'Mettre à jour',
			'proveit-prompt-name': "La référence a besoin d'un nom pour être réutilisée:",
			'proveit-confirm-remove': "Cela supprimera la référence dans tout l'article. Êtes-vous sûr?",
			'proveit-no-template': 'Aucun modèle',
			'proveit-no-references': 'Aucune référence trouvée'
		},
		'it': {
			'proveit-list-tab': 'Lista ($1)',
			'proveit-add-tab': 'Aggiungere',
			'proveit-reference-name-label': 'Nome di riferimento',
			'proveit-reference-content-label': 'Contenuti di riferimento',
			'proveit-reference-template-label': 'Template principale',
			'proveit-cite-button': 'Citare',
			'proveit-remove-button': 'Cancellare',
			'proveit-insert-button': 'Inserire',
			'proveit-update-button': 'Aggiornare',
			'proveit-prompt-name': 'Il riferimento ha bisogno di un nome per essere citati:',
			'proveit-confirm-remove': 'Questo elimina il riferimento e tutti gli citazione. Sei sicuro?',
			'proveit-no-template': 'Senza template',
			'proveit-no-references': 'Nessun riferimento trovato'
		},
		'ru': {
			'proveit-list-tab': 'Список ($1)',
			'proveit-add-tab': 'Добавить',
			'proveit-reference-name-label': 'Имя сноски',
			'proveit-reference-content-label': 'Содержание сноски',
			'proveit-reference-template-label': 'Основной шаблон',
			'proveit-cite-button': 'Цитировать',
			'proveit-remove-button': 'Удалить',
			'proveit-insert-button': 'Вставить',
			'proveit-update-button': 'Обновить',
			'proveit-prompt-name': 'Источнику нужно задать имя, чтобы его процитировать:',
			'proveit-confirm-remove': 'Будет удален источник и все его цитаты. Вы уверены?',
			'proveit-no-template': 'Нет шаблона',
			'proveit-no-references': 'Источники не найдены'
		}
	},

	/**
	 * Template data retrieved from the wiki
	 *
	 * @type {object}
	 */
	templates: {},

	/**
	 * Interface language (may be different from the content language)
	 *
	 * @type {string} defaults to English
	 */
	userLanguage: 'en',

	/**
	 * Content language (may be different from the user language)
	 *
	 * @type {string} defaults to English
	 */
	contentLanguage: 'en',

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
	 * @param {int} number of references
	 * @return {string} message value
	 */
	getMessage: function ( key, param ) {
		return mw.message( 'proveit-' + key, param );
	},

	/**
	 * Convenience method to get the edit textbox
	 *
	 * @return {jQuery} edit textbox
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
		mw.messages.set( proveit.messages[ proveit.userLanguage ] );

		// Set the content language
		var contentLanguage = mw.config.get( 'wgContentLanguage' );
		if ( contentLanguage ) {
			proveit.contentLanguage = contentLanguage;
		}

		// Build the interface
		proveit.build();

		// Get the template data from the wiki
		var templates = proveit.getOption( 'templates' );
		new mw.Api().get({
			'action': 'templatedata',
			'titles': templates ? templates.join( '|' ) : null,
			'format': 'json'
		}).done( function ( data ) {
			//console.log( data );
			for ( var page in data.pages ) {
				page = data.pages[ page ];
				proveit.templates[ page.title ] = page.params;
			}
			proveit.scanForReferences();
		});

		// Replace the reference button for the ProveIt button
		proveit.getTextbox().wikiEditor( 'removeFromToolbar', {
			'section': 'main',
			'group': 'insert',
			'tool': 'reference'
		});
		proveit.getTextbox().wikiEditor( 'addToToolbar', {
			'section': 'main',
			'group': 'insert',
			'tools': {
				'proveit': {
					'label': 'ProveIt',
					'type': 'button',
					'icon': proveit.ICON,
					'action': {
						'type': 'callback',
						'execute': function () {
							$( '#proveit' ).toggle();
						}
					}
				}
			}
		});
	},

	/**
	 * Build the GUI and add it to the DOM
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
			listTab = $( '<span>' ).attr( 'id', 'proveit-list-tab' ).addClass( 'active' ).text( proveit.getMessage( 'list-tab', 0 ) ),
			addTab = $( '<span>' ).attr( 'id', 'proveit-add-tab' ).text( proveit.getMessage( 'add-tab' ) ),
			content = $( '<div>' ).attr( 'id', 'proveit-content' );

		// Put everything together and add it to the DOM
		logo.prepend( leftBracket ).append( rightBracket );
		header.append( logo, listTab, addTab );
		gui.append( header,	content );
		$( 'body' ).prepend( gui );

		// Make the GUI draggable
		var dragged = false;
		mw.loader.using( 'jquery.ui.draggable' ).then( function () {
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
		});

		// Lastly, bind events
		logo.click( function () {
			if ( dragged ) {
				dragged = false; // Reset the flag
				return;
			}
			listTab.toggle();
			addTab.toggle();
			content.toggle();
			gui.css({
				'top': 'auto',
				'left': 'auto',
				'right': 0,
				'bottom': 0
			});
		}).click(); // Click the logo to hide the gadget by default

		listTab.click( function () {
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
			// Create a dummy reference and a dummy form out of it
			var template = $.cookie( 'proveit-last-template' ), // Remember the user choice
				dummyReference = new proveit.Reference({ 'template': template }),
				dummyForm = dummyReference.toForm();

			content.html( dummyForm );

			// Switch the GUI to add mode
			$( this ).addClass( 'active' ).siblings().removeClass( 'active' );
			$( '#proveit-insert-button' ).show();
			$( '#proveit-cite-button, #proveit-remove-button, #proveit-update-button' ).hide();
		});
	},

	/**
	 * Scan for references in the textbox and display them
	 *
	 * @return {void}
	 */
	scanForReferences: function () {

		// First define the list element
		var referenceList = $( '<ol>' ).attr( 'id', 'proveit-reference-list' );

		// Second, look for all the citations in the wikitext and store them in an array for later
		var wikitext = proveit.getTextbox().val(),
			citations = [],
			citationsRegExp = /<\s*ref\s+name\s*=\s*["|']?\s*([^"'\s]+)\s*["|']?\s*\/\s*>/ig, // Three patterns: <ref name="foo" />, <ref name='foo' /> and <ref name=foo />
			match,
			citation;

		while ( ( match = citationsRegExp.exec( wikitext ) ) ) {
			citation = new proveit.Citation({ 'name': match[1], 'index': match.index, 'string': match[0] });
			citations.push( citation );
		}

		// Third, look for all the raw and template references
		var matches = wikitext.match( /<\s*ref[^\/]*>[\s\S]*?<\s*\/\s*ref\s*>/ig ); // We use [\s\S]* instead of .* to match newlines

		if ( matches ) {
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

				// Add the reference number
				// We don't use the <ol> numbers because of stying reasons
				referenceItem.prepend( $( '<span>' ).addClass( 'proveit-reference-number' ).text( i + 1 ) );

				// Add the item to the list
				referenceList.append( referenceItem );
			}
			$( '#proveit-list-tab' ).text( proveit.getMessage( 'list-tab', i ) );
			$( '#proveit-content' ).html( referenceList );
		} else {
			$( '#proveit-list-tab' ).text( proveit.getMessage( 'list-tab', 0 ) );
			$( '#proveit-content' ).html( $( '<div>' ).attr( 'id', 'proveit-no-references-message' ).text( proveit.getMessage( 'no-references' ) ) );
		}
	},

	/**
	 * Make a reference object out of a reference string
	 *
	 * @param {string} wikitext of the reference
	 * @return {object} reference object
	 */
	makeReference: function ( referenceString ) {
		// Extract the name, if any
		// Three patterns: <ref name="foo">, <ref name='foo'> and <ref name=foo>
		var referenceName = null,
			match = referenceString.match( /<[\s]*ref[\s]*name[\s]*=[\s]*(?:(?:\"(.*?)\")|(?:\'(.*?)\')|(?:(.*?)))[\s]*>/i );
		if ( match ) {
			referenceName = match[1] || match[2] || match[3];
		}

		// Extract the index
		var referenceIndex = proveit.getTextbox().val().indexOf( referenceString );

		// Extract the content
		var referenceContent = referenceString.match( />([\s\S]*)<\s*\/\s*ref\s*>/i )[1]; // We use [\s\S]* instead of .* to match newlines

		// Build the basic reference
		var reference = new proveit.Reference({
			'name': referenceName,
			'index': referenceIndex,
			'string': referenceString,
			'content': referenceContent
		});

		// Determine if the reference uses a template by getting all the registered template names and searching for a match
		var registeredTemplatesArray = [];
		for ( var registeredTemplate in proveit.templates ) {
			registeredTemplate = registeredTemplate.substring( registeredTemplate.indexOf( ':' ) + 1 ); // Remove the namespace
			registeredTemplatesArray.push( registeredTemplate );
		}
		var registeredTemplatesDisjunction = registeredTemplatesArray.join( '|' ),
			regExp = new RegExp( '{{(' + registeredTemplatesDisjunction + ')([\\s\\S]*)}}', 'i' ); // We use [\s\S]* instead of .* to match newlines
		match = referenceContent.match( regExp );

		// If there's a match, add the template data to the reference
		if ( match ) {
			reference.templateString = match[0];

			// Extract and the template name and normalize it
			var template = match[1];
			registeredTemplatesArray.forEach( function ( registeredTemplate ) {
				if ( template.toLowerCase() === registeredTemplate.toLowerCase() ) {
					template = registeredTemplate;
				}
			});
			reference.template = template;

			// Extract the parameters and normalize them
			var paramsArray = match[2].split( '|' ),
				paramString, paramNameAndValue, paramName, paramValue;

			paramsArray.shift(); // The first element is always empty

			for ( paramString in paramsArray ) {

				paramNameAndValue = paramsArray[ paramString ].split( '=' );
				paramName = $.trim( paramNameAndValue[0] );
				paramValue = $.trim( paramNameAndValue[1] );

				if ( !paramName || !paramValue ) {
					continue;
				}

				reference.params[ paramName ] = paramValue;
			}
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
		$( '#editform' ).prepend( tagInput );
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
		$( '#wpSummary' ).val( currentSummary ? currentSummary + proveitSummary : proveitSummary );
	},

	/**
	 * Citation class
	 *
	 * @param {object} data for constructing the object
	 */
	Citation: function ( data ) {

		/**
		 * Citation name
		 */
		this.name = data.name ? data.name : '';

		/**
		 * Citation location in the edit textbox
		 */
		this.index = data.index ? data.index : 0;

		/**
		 * Citation wikitext
		 *
		 * Example: <ref name="abc" />
		 */
		this.string = data.string ? data.string : '';

		/**
		 * Convert this citation to wikitext
		 */
		this.toString = function () {
			return '<ref name="' + this.name + '" />';
		};

		/**
		 * Insert this citation into the textbox
		 */
		this.insert = function () {
			var textbox = proveit.getTextbox();
			textbox.textSelection( 'encapsulateSelection', {
				'peri': this.toString(),
				'replace': true
			});
		};

		/**
		 * Highlight the citation in the textbox and scroll it to view
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
	 * Reference class
	 *
	 * @param {object} Data for constructing the object
	 */
	Reference: function ( data ) {

		/**
		 * Extend the Citation class
		 */
		proveit.Citation.call( this, data );

		/**
		 * Reference content (without the <ref> tags)
		 *
		 * Example: Second chapter of {{Cite book |first=Charles |last=Darwin |title=On the Origin of Species}}
		 */
		this.content = data.content ? data.content : '';

		/**
		 * Array of citations to this reference
		 */
		this.citations = [];

		/**
		 * Name of the main template of this reference, if any
		 *
		 * Example: Cite book
		 */
		this.template = data.template ? data.template : null;

		/**
		 * Wikitext of the main template, if any
		 *
		 * Example: {{Cite book |first=Charles |last=Darwin |title=On the Origin of Species}}
		 */
		this.templateString = data.templateString ? data.templateString : '';

		/**
		 * Object mapping the parameter names of this reference to their values
		 *
		 * This object is constructed directly out of the wikitext, so it doesn't include
		 * any information about the parameters other than their names and values.
		 * Also the parameter names here may be aliases.
		 */
		this.params = {};

		/**
		 * Insert a citation to this reference
		 *
		 * @return {void}
		 */
		this.cite = function ( event ) {
			var reference = event.data;

			// If the reference has no name, ask the user for one
			// @todo check if the name is unique?
			// @todo autogenerate names?
			if ( !reference.name ) {
				reference.name = prompt( proveit.getMessage( 'prompt-name' ) );
				if ( !reference.name ) {
					return;
				}
				var table = reference.toTable();
				$( '#proveit-reference-table' ).replaceWith( table );

				var oldString = reference.string;
				reference.loadFromForm();
				var newString = reference.string;

				// Replace the old reference
				var textbox = proveit.getTextbox(),
					text = textbox.val().replace( oldString, newString );
				textbox.val( text );
			}

			// Add the citation
			var citation = new proveit.Citation({ 'name': reference.name });
			citation.insert();
		};

		/**
		 * Remove this reference and all its citations
		 *
		 * @param {object} click event, with the reference as data
		 * @return {void}
		 */
		this.remove = function ( event ) {
			var reference = event.data;

			// Make sure the user understands that the citations will also be removed
			if ( confirm( proveit.getMessage( 'confirm-remove' ) ) ) {

				// Remove the reference
				var textbox = proveit.getTextbox(),
					text = textbox.val();
				text = text.replace( reference.string, '' );

				// Remove all the citations
				// @todo citation.remove()
				reference.citations.forEach( function ( citation ) {
					text = text.replace( citation.string, '' );
				});

				// Update the textbox
				textbox.val( text );

				// Add the tag and summary
				proveit.addTag();
				proveit.addSummary();

				// Switch to add mode
				$( '#proveit-add-tab' ).addClass( 'active' ).siblings().removeClass( 'active' );
				$( '#proveit-insert-button' ).show();
				$( '#proveit-cite-button, #proveit-remove-button, #proveit-update-button' ).hide();
			}
		};

		/**
		 * Update the wikitext in the textbox with the current data of this reference
		 *
		 * @param {object} click event, with the reference as data
		 * @return {void}
		 */
		this.update = function ( event ) {
			var reference = event.data;

			var oldName = reference.name,
				oldString = reference.string;
			reference.loadFromForm();
			var newName = reference.name,
				newString = reference.string;

			// Replace the old reference
			var textbox = proveit.getTextbox(),
				text = textbox.val();
			text = text.replace( oldString, newString );

			// If the name changed, update the citations
			// @todo citation.update()
			if ( oldName !== newName && reference.citations ) {
				var oldCitationString, newCitationString;
				reference.citations.forEach( function ( citation ) {
					oldCitationString = citation.toString();
					citation.name = newName;
					newCitationString = citation.toString();
					text = text.replace( oldCitationString, newCitationString );
				});
			}

			// Update the textbox
			textbox.val( text );

			// Update the index and highlight the reference
			text = textbox.val();
			reference.index = text.indexOf( newString );
			reference.highlight();

			// Update the GUI
			$( '#proveit-reference-table' ).replaceWith( reference.toTable() );

			// Add the tag and summary
			proveit.addTag();
			proveit.addSummary();
		};

		/**
		 * Insert this reference into the textbox
		 *
		 * @param {object} click event, with the reference as data
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

			// Update the index
			reference.index = textbox.val().indexOf( reference.string );

			// Switch to edit mode
			$( '#proveit-list-tab' ).addClass( 'active' ).siblings().removeClass( 'active' );
			$( '#proveit-reference-table' ).replaceWith( reference.toTable() );
			$( '#proveit-insert-button' ).hide().siblings().show();

			// Add the tag and summary
			proveit.addTag();
			proveit.addSummary();
		};

		/**
		 * Get the registered parameters for this reference
		 *
		 * @return {object} TemplateData of the registered parameters
		 */
		this.getRegisteredParams = function () {
			var formattedNamespaces = mw.config.get( 'wgFormattedNamespaces' ),
				templateNamespace = formattedNamespaces[10];
			return proveit.templates[ templateNamespace + ':' + this.template ];
		};

		/**
		 * Get the required parameters for this reference
		 *
		 * @return {object} TemplateData of the required parameters
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
		 * @return {object} TemplateData of the suggested parameters
		 */
		this.getSuggestedParams = function () {
			var suggestedParams = {},
				registeredParams = this.getRegisteredParams();
			for ( var registeredParam in registeredParams ) {
				if ( registeredParams[ registeredParam ].suggested ) {
					suggestedParams[ registeredParam ] = registeredParams[ registeredParam ];
				}
			}
			return suggestedParams;
		};

		/**
		 * Get the optional parameters for this reference
		 *
		 * @return {object} TemplateData of the optional parameters
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
		 * Get the registered params but sorted by required first, suggested later, optional last
		 *
		 * @return {object} TemplateData of the sorted parameters
		 */
		this.getSortedParams = function () {
			var requiredParams = this.getRequiredParams(),
				suggestedParams = this.getSuggestedParams(),
				optionalParams = this.getOptionalParams();
			return $.extend( requiredParams, suggestedParams, optionalParams );
		};

		/**
		 * Convert this reference to wikitext
		 *
		 * @return {string} wikitext for this reference
		 */
		this.toString = function () {
			// Build the opening ref tag
			var string = '<ref';
			if ( this.name ) {
				string += ' name="' + this.name + '"';
			}
			string += '>';

			// Build the template string
			if ( this.template ) {
				var templateString = '{{' + this.template;
				for ( var name in this.params ) {
					templateString += ' |' + name + '=' + this.params[ name ];
				}
				templateString += '}}';
				// Build the content string by replacing the old template string with the new
				// By doing this we keep any content that before or after the template string
				this.content = this.content.replace( this.templateString, templateString );
				this.templateString = templateString;
			}
			// Add the content
			string += this.content;

			// Close and return the reference
			string += '</ref>';
			return string;
		};

		/**
		 * Convert this reference to a list item
		 *
		 * @return {jQuery} list item
		 */
		this.toListItem = function () {
			var item = $( '<li>' ).addClass( 'proveit-reference-item' );

			// Add the main content
			if ( this.template ) {

				// First add the template name
				var templateSpan = $( '<span>' ).addClass( 'proveit-reference-template' ).text( this.template );
				item.html( templateSpan );

				// Search the values of the first three parameters and add them to the list item
				// We search for the first three values rather than the required ones because
				// some tempalates (like Template:Citation) don't have any required parameters
				// but we sort the parameters to give priority to the required parameters
				var sortedParams = this.getSortedParams(),
					paramCount = 0, paramValue, paramData, paramAlias, paramSpan;
				for ( var paramName in sortedParams ) {
					paramValue = '';
					if ( paramName in this.params ) {
						paramValue = this.params[ paramName ];
					} else {
						paramData = sortedParams[ paramName ];
						for ( var i = 0; i < paramData.aliases.length; i++ ) {
							paramAlias = paramData.aliases[ i ];
							paramAlias = $.trim( paramAlias );
							if ( paramAlias in this.params ) {
								paramValue = this.params[ paramAlias ];
							}
						}
					}
					if ( paramValue ) {
						paramSpan = $( '<span>' ).addClass( 'proveit-param-value' ).text( paramValue );
						item.append( paramSpan );
						paramCount++;
						if ( paramCount === 3 ) {
							break;
						}
					}
				}
			} else {
				item.text( this.content );
			}

			// Add the citations
			var citations = $( '<span>' ).addClass( 'proveit-citations' );
			for ( var i = 1; i <= this.citations.length; i++ ) {
				citations.append( $( '<a>' ).addClass( 'proveit-citation' ).text( i ) );
			}
			item.append( citations );

			// Bind events
			item.click( this, function ( event ) {
				var reference = event.data,
					form = reference.toForm();
				reference.highlight();
				$( '#proveit-content' ).html( form );
				$( '#proveit-insert-button' ).hide().siblings().show();
			});

			$( '.proveit-citation', item ).click( this, function ( event ) {
				var reference = event.data,
					i = parseInt( $( this ).text(), 10 ) - 1,
					citation = reference.citations[ i ];
				citation.highlight();
				event.stopPropagation();
			});

			return item;
		};

		/**
		 * Convert this reference into a HTML table
		 *
		 * @return {jQuery} table
		 */
		this.toTable = function () {
			var table = $( '<table>' ).attr( 'id', 'proveit-reference-table' );

			// Add the reference name field
			var referenceNameRow = $( '<tr>' ),
				referenceNameLabel = $( '<label>' ).text( proveit.getMessage( 'reference-name-label' ) ),
				referenceNameInput = $( '<input>' ).attr( 'name', 'reference-name' ).val( this.name );
			referenceNameRow.append( referenceNameLabel, referenceNameInput );
			table.append( referenceNameRow );

			// Add the reference content area
			var referenceContentRow = $( '<tr>' ),
				referenceContentLabel = $( '<label>' ).text( proveit.getMessage( 'reference-content-label' ) ),
				referenceContentTextarea = $( '<textarea>' ).attr( 'name', 'reference-content' ).val( this.content );
			referenceContentRow.append( referenceContentLabel, referenceContentTextarea );
			table.append( referenceContentRow );

			// Add the template dropdown menu
			var templateRow = $( '<tr>' ),
				templateLabel = $( '<label>' ).text( proveit.getMessage( 'reference-template-label' ) ),
				templateSelect = $( '<select>' ).attr( 'name', 'reference-template' ),
				templateName = proveit.getMessage( 'no-template' ),
				templateOption = $( '<option>' ).text( templateName ).val( '' );
			templateSelect.append( templateOption );
			templateRow.append( templateLabel, templateSelect );
			for ( templateName in proveit.templates ) {
				templateName = templateName.substr( templateName.indexOf( ':' ) + 1 ); // Remove the namespace
				templateOption = $( '<option>' ).text( templateName ).val( templateName );
				if ( this.template === templateName ) {
					templateOption.attr( 'selected', 'selected' );
				}
				templateSelect.append( templateOption );
			}
			templateRow.append( templateLabel, templateSelect );
			table.append( templateRow );

			// Add the parameter fields
			var sortedParams = this.getSortedParams(),
				requiredParams = this.getRequiredParams(),
				paramData, paramLabel, paramPlaceholder, paramDescription, paramAlias, paramValue, row, label, paramNameInput, paramValueInput;

			for ( var paramName in sortedParams ) {

				paramData = sortedParams[ paramName ];

				// Defaults
				paramLabel = paramName;
				paramPlaceholder = '';
				paramDescription = '';
				paramValue = '';

				// Override with template data
				if ( paramData.label ) {
					paramLabel = paramData.label[ proveit.contentLanguage ];
				}

				// If the parameter is a date, put the current date as a placeholder
				// @todo find a better solution
				if ( paramData.type === 'date' ) {
					var date = new Date(),
						yyyy = date.getFullYear(),
						mm = ( '0' + ( date.getMonth() + 1 ) ).slice( -2 ),
						dd = ( '0' + date.getDate() ).slice( -2 );
					paramPlaceholder = yyyy + '-' + mm + '-' + dd;
				}

				if ( paramData.description ) {
					paramDescription = paramData.description[ proveit.contentLanguage ];
				}

				// Extract the parameter value
				if ( paramName in this.params ) {
					paramValue = this.params[ paramName ];
				} else {
					for ( var i = 0; i < paramData.aliases.length; i++ ) {
						paramAlias = paramData.aliases[ i ];
						paramAlias = $.trim( paramAlias );
						if ( paramAlias in this.params ) {
							paramValue = this.params[ paramAlias ];
						}
					}
				}

				// Build the table row
				row = $( '<tr>' ).addClass( 'proveit-param-pair' );
				label = $( '<label>' ).attr( 'title', paramDescription ).text( paramLabel );
				paramNameInput = $( '<input>' ).attr( 'type', 'hidden' ).addClass( 'proveit-param-name' ).val( paramName );
				paramValueInput = $( '<input>' ).attr( 'placeholder', paramPlaceholder ).addClass( 'proveit-param-value' ).val( paramValue );

				// Exception
				if ( paramName === 'quote' || paramName === 'cita' ) {
					paramValueInput = $( '<textarea>' ).attr( 'placeholder', paramPlaceholder ).addClass( 'proveit-param-value' ).val( paramValue );
				}

				// Mark the required parameters
				if ( paramName in requiredParams ) {
					row.addClass( 'proveit-required' );
				}

				// Put it all together and add it to the table
				row.append( label, paramValueInput, paramNameInput );
				table.append( row );
			}

			// Bind events
			templateSelect.change( this, function ( event ) {
				var reference = event.data;
				reference.template = $( this ).val();
				$.cookie( 'proveit-last-template', reference.template ); // Remember the user choice
				table.replaceWith( reference.toTable() );
			});

			return table;
		};

		/**
		 * Convert this reference to an HTML form filled with its data
		 *
		 * @return {jQuery} form
		 */
		this.toForm = function () {

			var form = $( '<form>' ).attr( 'id', 'proveit-reference-form' ),
				table = this.toTable();

			// Add the buttons
			var buttons = $( '<div>' ).attr( 'id', 'proveit-buttons' ),
				citeButton = $( '<button>' ).attr( 'id', 'proveit-cite-button' ).text( proveit.getMessage( 'cite-button' ) ),
				removeButton = $( '<button>' ).attr( 'id', 'proveit-remove-button' ).text( proveit.getMessage( 'remove-button' ) ),
				updateButton = $( '<button>' ).attr( 'id', 'proveit-update-button' ).text( proveit.getMessage( 'update-button' ) ),
				insertButton = $( '<button>' ).attr( 'id', 'proveit-insert-button' ).text( proveit.getMessage( 'insert-button' ) );
			buttons.append( citeButton, removeButton, updateButton, insertButton );
			form.append( table, buttons );

			// Bind events
			form.submit( false );
			citeButton.click( this, this.cite );
			removeButton.click( this, this.remove );
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

			this.content = $( '#proveit-reference-form textarea[name="reference-content"]' ).val();

			this.template = $( '#proveit-reference-form select[name="reference-template"]' ).val();

			// Load all the parameter key-value pairs
			var params = {}, name, value;
			$( '.proveit-param-pair' ).each( function () {
				name = $( '.proveit-param-name', this ).val();
				value = $( '.proveit-param-value', this ).val();
				if ( name !== '' && value !== '' ) {
					params[ name ] = value;
				}
			});
			this.params = params;

			this.string = this.toString();
		};
	}
};

$( proveit.init );

}( mw, jQuery ) );